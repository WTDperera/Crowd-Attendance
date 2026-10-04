import 'package:lecturer_app/services/firebase_environment.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../services/report_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String? selectedSessionId;
  final _searchController = TextEditingController();
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: const Text(
          'Software project',
          style: TextStyle(color: Colors.white),
        ),
        leading: selectedSessionId != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () {
                  setState(() {
                    selectedSessionId = null;
                  });
                },
              )
            : null,
      ),
      body: selectedSessionId == null
          ? _buildSessionsList()
          : _buildSessionDetail(),
    );
  }

  Widget _buildSessionsList() {
    User? user = appAuth.currentUser;
    if (user == null) return const Center(child: Text('Not logged in'));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Attendance Reports',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          
          StreamBuilder<QuerySnapshot>(
            stream: appFirestore
                .collection('active_sessions')
                .where('lecturer_id', isEqualTo: user.uid)
                .where('status', isEqualTo: 'completed')
                .orderBy('created_at', descending: true)
                .limit(50)
                .snapshots(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 60),
                      Icon(Icons.description_outlined, size: 80, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'No attendance sessions yet',
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Start a session from the Session tab',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    ],
                  ),
                );
              }

              return ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: snapshot.data!.docs.length,
                itemBuilder: (context, index) {
                  var session = snapshot.data!.docs[index];
                  return _buildSessionCard(session);
                },
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSessionCard(DocumentSnapshot session) {
    final sessionData = session.data() as Map<String, dynamic>? ?? {};
    String className = sessionData['class_name'] ?? sessionData['module_code'] ?? sessionData['module'] ?? 'Unknown Class';
    int studentCount = ((sessionData['student_count'] ?? 0) as num).toInt().clamp(0, 1 << 30);
    Timestamp? startTime = sessionData['start_time'] ?? sessionData['started_at'] ?? sessionData['created_at'];
    Timestamp? endTime = sessionData['end_time'] ?? sessionData['ended_at'];
    String status = sessionData['status'] ?? 'Completed';
    
    DateTime date = (startTime?.toDate() ?? DateTime.now()).toUtc().add(const Duration(hours: 5, minutes: 30));
    String formattedDate = DateFormat('MMMM dd, yyyy').format(date);
    String formattedTime = sessionData['duration_formatted'] ?? 
      (startTime != null && endTime != null
        ? '${DateFormat('hh:mm a').format(startTime.toDate().toUtc().add(const Duration(hours: 5, minutes: 30)))} - ${DateFormat('hh:mm a').format(endTime.toDate().toUtc().add(const Duration(hours: 5, minutes: 30)))}'
        : DateFormat('hh:mm a').format(date));

    return GestureDetector(
      onTap: () {
        setState(() {
          selectedSessionId = session.id;
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    className,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (status == 'Active Session')
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Active',
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
                Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 6),
                Text(
                  formattedDate,
                  style: TextStyle(color: Colors.grey[700], fontSize: 13),
                ),
                const SizedBox(width: 16),
                Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 6),
                Text(
                  formattedTime,
                  style: TextStyle(color: Colors.grey[700], fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text('Present: ', style: TextStyle(fontSize: 14)),
                    Text(
                      '$studentCount',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF4CAF50),
                      ),
                    ),
                  ],
                ),
                Text(
                  '${((sessionData['total_students'] as num? ?? 0) > 0 ? studentCount / (sessionData['total_students'] as num) * 100 : 0).toStringAsFixed(2)}%',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: studentCount > 0 ? const Color(0xFF4CAF50) : Colors.grey,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSessionDetail() {
    return FutureBuilder<Map<String, dynamic>>(
      future: ReportService().sessionReport(selectedSessionId!),
      builder: (context, sessionSnapshot) {
        if (sessionSnapshot.hasError) return const Center(child: Text('Unable to load report'));
        if (!sessionSnapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final report = sessionSnapshot.data!;
        final sessionData = report['session'] as Map<String, dynamic>;
        String className = (report['module'] as Map<String, dynamic>)['module_name'] as String? ?? 'Unknown Class';
        String formattedDate = sessionData['date'] as String? ?? 'N/A';
        final started = DateTime.tryParse(sessionData['started_at'] as String? ?? '');
        String formattedTime = started == null ? '—' : DateFormat('hh:mm a').format(started.toUtc().add(const Duration(hours: 5, minutes: 30)));

        return SingleChildScrollView(
          child: Column(
            children: [
              // Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: Colors.white,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Attendance Report',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Stack(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.notifications_outlined),
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
                    Text(
                      className,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
                        const SizedBox(width: 6),
                        Text(formattedDate, style: TextStyle(color: Colors.grey[700])),
                        const SizedBox(width: 12),
                        Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
                        const SizedBox(width: 6),
                        Text(formattedTime, style: TextStyle(color: Colors.grey[700])),
                      ],
                    ),
                    const SizedBox(height: 20),
                    
                    // Stats
                    Builder(
                      builder: (context) {
                        final totals = report['totals'] as Map<String, dynamic>;
                        int presentCount = (totals['total_present'] as int) + (totals['total_excused'] as int);
                        int totalStudents = totals['total_students'] as int;
                        String percentage = (totals['attendance_percentage'] as num).toStringAsFixed(2);

                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              Column(
                                children: [
                                  const Text(
                                    'Present',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '$presentCount',
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                height: 40,
                                width: 1,
                                color: Colors.grey[400],
                              ),
                              Column(
                                children: [
                                  const Text(
                                    'Total',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '$totalStudents',
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                height: 40,
                                width: 1,
                                color: Colors.grey[400],
                              ),
                              Column(
                                children: [
                                  const Text(
                                    'Percentage',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '$percentage%',
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF4CAF50),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              
              // Tabs
              DefaultTabController(
                length: 2,
                child: Column(
                  children: [
                    Container(
                      color: Colors.white,
                      child: const TabBar(
                        labelColor: Color(0xFF2196F3),
                        unselectedLabelColor: Colors.grey,
                        indicatorColor: Color(0xFF2196F3),
                        tabs: [
                          Tab(text: 'Students'),
                          Tab(text: 'Summary'),
                        ],
                      ),
                    ),
                    Container(
                      height: MediaQuery.of(context).size.height * 0.5,
                      color: const Color(0xFFF5F5F5),
                      child: TabBarView(
                        children: [
                          _buildStudentsList(),
                          _buildSummaryTab(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStudentsList() {
    return Column(
      children: [
        // Search Bar
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search students...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.filter_list),
              ),
            ],
          ),
        ),
        
        // Students List
        Expanded(
          child: FutureBuilder<Map<String, dynamic>>(
            future: ReportService().sessionReport(selectedSessionId!),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) return const Center(child: Text('Unable to load report'));
              if (!snapshot.hasData || (snapshot.data!['records'] as List<dynamic>).isEmpty) {
                return const Center(child: Text('No students recorded'));
              }

              var students = List<Map<String, dynamic>>.from(snapshot.data!['records'] as List<dynamic>);
              
              // Filter by search
              if (_searchController.text.isNotEmpty) {
                students = students.where((doc) {
                  String regNo = doc['reg_no'].toString().toLowerCase();
                  return regNo.contains(_searchController.text.toLowerCase());
                }).toList();
              }

              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: students.length,
                itemBuilder: (context, index) {
                  final studentData = students[index];
                  String regNo = studentData['reg_no'] ?? '';
                  String time = studentData['time_marked'] as String? ?? '--';
                  String durationDisplay = studentData['duration_formatted'] ?? time;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.green[50],
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.person,
                            color: Color(0xFF4CAF50),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                studentData['name'] ?? 'Student',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              Text(
                                regNo,
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              durationDisplay,
                              style: TextStyle(
                                color: Colors.grey[700],
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (studentData['duration_formatted'] != null)
                              Text(
                                'Marked at $time',
                                style: TextStyle(
                                  color: Colors.grey[500],
                                  fontSize: 11,
                                ),
                              ),
                            const SizedBox(height: 4),
                            Text(studentData['saved_status'] as String? ?? 'Absent'),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryTab() {
    return const Center(
      child: Text('Summary analytics coming soon...'),
    );
  }
}
