import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/firestore_service.dart';
import '../models/student_model.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  final _firestoreService = FirestoreService();
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Students',
                        style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold)),
                    SizedBox(height: 4),
                    Text('Manage student accounts & devices',
                        style: TextStyle(
                            color: Colors.grey, fontSize: 14)),
                  ],
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _showAddStudentDialog,
                  icon: const Icon(Icons.person_add, size: 18),
                  label: const Text('Add Student'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00BCD4),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Search Bar
            SizedBox(
              height: 44,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search by reg. number or email...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide:
                        BorderSide(color: Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide:
                        BorderSide(color: Colors.grey.shade300),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(vertical: 10),
                ),
                onChanged: (v) =>
                    setState(() => _searchQuery = v.toLowerCase()),
              ),
            ),
            const SizedBox(height: 16),

            // Students Table
            Expanded(
              child: StreamBuilder<List<StudentModel>>(
                stream: _firestoreService.getStudentsStream(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState ==
                      ConnectionState.waiting) {
                    return const Center(
                        child: CircularProgressIndicator());
                  }
                  var students = snapshot.data ?? [];

                  if (_searchQuery.isNotEmpty) {
                    students = students.where((s) {
                      return s.regNo
                              .toLowerCase()
                              .contains(_searchQuery) ||
                          s.email
                              .toLowerCase()
                              .contains(_searchQuery);
                    }).toList();
                  }

                  if (students.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.school_outlined,
                              size: 64,
                              color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text('No students found',
                              style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 16)),
                          const SizedBox(height: 8),
                          Text(
                              'Add students using the button above',
                              style: TextStyle(
                                  color: Colors.grey.shade400)),
                        ],
                      ),
                    );
                  }

                  return Card(
                    clipBehavior: Clip.hardEdge,
                    child: SingleChildScrollView(
                      child: Table(
                        columnWidths: const {
                          0: FixedColumnWidth(50),
                          1: FlexColumnWidth(2),
                          2: FlexColumnWidth(3),
                          3: FlexColumnWidth(2),
                          4: FlexColumnWidth(2),
                          5: FixedColumnWidth(130),
                        },
                        children: [
                          TableRow(
                            decoration: BoxDecoration(
                                color: Colors.grey.shade100),
                            children: const [
                              _TH('#'),
                              _TH('Reg. No.'),
                              _TH('Email'),
                              _TH('Device'),
                              _TH('Last Login'),
                              _TH('Actions'),
                            ],
                          ),
                          ...students.asMap().entries.map((e) {
                            final i = e.key;
                            final s = e.value;
                            final bg = i.isEven
                                ? Colors.white
                                : Colors.grey.shade50;
                            return TableRow(
                              decoration:
                                  BoxDecoration(color: bg),
                              children: [
                                _TC('${i + 1}',
                                    color: Colors.grey.shade500),
                                _TC(s.regNo.toUpperCase(),
                                    bold: true),
                                _TC(s.email),
                                Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: s.isDeviceLocked
                                      ? Row(children: [
                                          Icon(Icons.lock,
                                              size: 14,
                                              color: Colors
                                                  .green),
                                          const SizedBox(width: 4),
                                          const Text('Locked',
                                              style: TextStyle(
                                                  color:
                                                      Colors.green,
                                                  fontSize: 12)),
                                        ])
                                      : Row(children: [
                                          Icon(Icons.lock_open,
                                              size: 14,
                                              color: Colors
                                                  .grey),
                                          const SizedBox(width: 4),
                                          Text('Free',
                                              style: TextStyle(
                                                  color: Colors
                                                      .grey,
                                                  fontSize: 12)),
                                        ]),
                                ),
                                _TC(
                                  s.lastLogin != null
                                      ? DateFormat('MMM d, yy')
                                          .format(s.lastLogin!)
                                      : 'Never',
                                  color: s.lastLogin != null
                                      ? null
                                      : Colors.grey,
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 8, horizontal: 8),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (s.isDeviceLocked)
                                        Tooltip(
                                          message: 'Reset Device Lock',
                                          child: IconButton(
                                            icon: const Icon(
                                                Icons.phone_android,
                                                size: 18,
                                                color:
                                                    Colors.orange),
                                            onPressed: () =>
                                                _resetDevice(s.uid,
                                                    s.regNo),
                                            padding:
                                                EdgeInsets.zero,
                                            constraints:
                                                const BoxConstraints(),
                                          ),
                                        ),
                                      const SizedBox(width: 8),
                                      Tooltip(
                                        message: 'Delete Student',
                                        child: IconButton(
                                          icon: const Icon(
                                              Icons.delete,
                                              size: 18,
                                              color: Colors.red),
                                          onPressed: () =>
                                              _deleteStudent(
                                                  s.uid, s.regNo),
                                          padding: EdgeInsets.zero,
                                          constraints:
                                              const BoxConstraints(),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          }),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddStudentDialog() async {
    final uidCtrl = TextEditingController();
    final regNoCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Student'),
        content: SizedBox(
          width: 400,
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Create the student in Firebase Auth first, then add their UID here.',
                  style: TextStyle(
                      color: Colors.grey, fontSize: 12),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: uidCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Firebase UID',
                      hintText: 'Paste UID from Firebase Auth'),
                  validator: (v) => v == null || v.isEmpty
                      ? 'Required'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: regNoCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Registration No.',
                      hintText: 'eg2023001'),
                  validator: (v) => v == null || v.isEmpty
                      ? 'Required'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: emailCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Email'),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (!v.contains('@')) return 'Invalid email';
                    return null;
                  },
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              Navigator.pop(ctx);
              try {
                await _firestoreService.addStudent(
                  uid: uidCtrl.text.trim(),
                  regNo: regNoCtrl.text.trim(),
                  email: emailCtrl.text.trim(),
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Student added.'),
                        backgroundColor: Colors.green),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Error: $e'),
                        backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _resetDevice(String uid, String regNo) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Device Lock'),
        content: Text(
            'Remove device lock for $regNo? They can log in on a new device.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange),
            child: const Text('Reset',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await _firestoreService.resetStudentDevice(uid);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Device lock reset.')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }

  Future<void> _deleteStudent(String uid, String regNo) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Student'),
        content: Text(
            'Permanently delete $regNo from the database?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await _firestoreService.deleteStudent(uid);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Student deleted.')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }
}

class _TH extends StatelessWidget {
  final String text;
  const _TH(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: 12, horizontal: 12),
      child: Text(text,
          style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Colors.grey)),
    );
  }
}

class _TC extends StatelessWidget {
  final String text;
  final bool bold;
  final Color? color;
  const _TC(this.text, {this.bold = false, this.color});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: 12, horizontal: 12),
      child: Text(text,
          style: TextStyle(
              fontWeight:
                  bold ? FontWeight.bold : FontWeight.normal,
              fontSize: 13,
              color: color)),
    );
  }
}
