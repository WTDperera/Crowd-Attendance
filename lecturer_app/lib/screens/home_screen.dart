import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String lecturerName = '';
  int todaysSessions = 0;
  double avgAttendance = 89.0;

  @override
  void initState() {
    super.initState();
    _loadLecturerData();
  }

  Future<void> _loadLecturerData() async {
    User? user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      var doc = await FirebaseFirestore.instance
          .collection('lecturers')
          .doc(user.uid)
          .get();
      
      if (doc.exists) {
        setState(() {
          lecturerName = doc.get('name') ?? 'Dr. Smith';
        });
      }

      // Count today's sessions
      DateTime now = DateTime.now();
      DateTime startOfDay = DateTime(now.year, now.month, now.day);
      
      var sessions = await FirebaseFirestore.instance
          .collection('attendance_sessions')
          .where('lecturer_id', isEqualTo: user.uid)
          .where('created_at', isGreaterThanOrEqualTo: startOfDay)
          .get();
      
      setState(() {
        todaysSessions = sessions.docs.length;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: const Text(
          'Software project',
          style: TextStyle(color: Colors.white),
        ),
        leading: IconButton(
          icon: const Icon(Icons.menu, color: Colors.white),
          onPressed: () {},
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadLecturerData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Dashboard',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Stack(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_outlined, size: 28),
                        onPressed: () {},
                      ),
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),
              
              // Welcome Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Welcome, ${lecturerName.isNotEmpty ? lecturerName : "Loading..."}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    DateFormat('MMMM dd, yyyy').format(DateTime.now()),
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              
              // Stats Cards
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      'Today\'s Classes',
                      todaysSessions.toString(),
                      Icons.calendar_today,
                      const Color(0xFF2196F3),
                      Colors.blue[50]!,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildStatCard(
                      'Avg. Attendance',
                      '${avgAttendance.toStringAsFixed(0)}%',
                      Icons.trending_up,
                      const Color(0xFF4CAF50),
                      Colors.green[50]!,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              
              // Today's Classes
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Today\'s Classes',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text('View All'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              
              StreamBuilder<QuerySnapshot>(
                stream: _getTodaysSessions(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  
                  if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(Icons.event_busy, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 12),
                            Text(
                              'No sessions today',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                    );
                  }
                  
                  return Column(
                    children: snapshot.data!.docs.map((doc) {
                      return _buildClassCard(
                        doc.get('class_name') ?? 'Class',
                        doc.get('start_time') != null 
                            ? DateFormat('hh:mm a').format((doc.get('start_time') as Timestamp).toDate())
                            : 'Time TBD',
                        doc.get('status') ?? 'Completed',
                        doc.get('student_count') ?? 0,
                      );
                    }).toList(),
                  );
                },
              ),
              const SizedBox(height: 32),
              
              // Recent Attendance
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Attendance',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text('View All'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              
              _buildRecentAttendanceCard('CS301: Algorithms', 'Yesterday', 26, 28),
              _buildRecentAttendanceCard('CS400: Database Systems', '2 days ago', 31, 35),
            ],
          ),
        ),
      ),
    );
  }

  Stream<QuerySnapshot> _getTodaysSessions() {
    User? user = FirebaseAuth.instance.currentUser;
    if (user == null) return const Stream.empty();
    
    DateTime now = DateTime.now();
    DateTime startOfDay = DateTime(now.year, now.month, now.day);
    
    return FirebaseFirestore.instance
        .collection('attendance_sessions')
        .where('lecturer_id', isEqualTo: user.uid)
        .where('created_at', isGreaterThanOrEqualTo: startOfDay)
        .orderBy('created_at', descending: true)
        .snapshots();
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          top: BorderSide(color: color, width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 14,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClassCard(String title, String time, String status, int studentCount) {
    bool isActive = status == 'Active Session';
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(
            color: isActive ? const Color(0xFF4CAF50) : const Color(0xFF2196F3),
            width: 4,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (isActive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green[50],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Active Session',
                    style: TextStyle(
                      color: Color(0xFF4CAF50),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text(time, style: TextStyle(color: Colors.grey[700], fontSize: 14)),
              const SizedBox(width: 24),
              Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text('Today', style: TextStyle(color: Colors.grey[700], fontSize: 14)),
              const SizedBox(width: 24),
              Icon(Icons.people, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text('$studentCount', style: TextStyle(color: Colors.grey[700], fontSize: 14)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecentAttendanceCard(String title, String date, int present, int total) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: Color(0xFF2196F3), width: 4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text('11:00 AM', style: TextStyle(color: Colors.grey[700], fontSize: 14)),
              const SizedBox(width: 24),
              Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text(date, style: TextStyle(color: Colors.grey[700], fontSize: 14)),
              const SizedBox(width: 24),
              Icon(Icons.people, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text('$present/$total', style: TextStyle(color: Colors.grey[700], fontSize: 14)),
            ],
          ),
        ],
      ),
    );
  }
}
