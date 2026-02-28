import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/firestore_service.dart';
import '../models/lecturer_model.dart';

class LecturersScreen extends StatefulWidget {
  const LecturersScreen({super.key});

  @override
  State<LecturersScreen> createState() => _LecturersScreenState();
}

class _LecturersScreenState extends State<LecturersScreen> {
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
                    Text('Lecturers',
                        style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold)),
                    SizedBox(height: 4),
                    Text('Manage lecturer accounts & devices',
                        style: TextStyle(
                            color: Colors.grey, fontSize: 14)),
                  ],
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _showAddLecturerDialog,
                  icon: const Icon(Icons.person_add, size: 18),
                  label: const Text('Add Lecturer'),
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

            // Search
            SizedBox(
              height: 44,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search by name or email...',
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

            // Lecturers Table
            Expanded(
              child: StreamBuilder<List<LecturerModel>>(
                stream: _firestoreService.getLecturersStream(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState ==
                      ConnectionState.waiting) {
                    return const Center(
                        child: CircularProgressIndicator());
                  }
                  var lecturers = snapshot.data ?? [];

                  if (_searchQuery.isNotEmpty) {
                    lecturers = lecturers.where((l) {
                      return l.name
                              .toLowerCase()
                              .contains(_searchQuery) ||
                          l.email
                              .toLowerCase()
                              .contains(_searchQuery);
                    }).toList();
                  }

                  if (lecturers.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.person_outlined,
                              size: 64,
                              color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text('No lecturers found',
                              style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 16)),
                          const SizedBox(height: 8),
                          Text(
                              'Add lecturers using the button above',
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
                          5: FlexColumnWidth(2),
                          6: FixedColumnWidth(130),
                        },
                        children: [
                          TableRow(
                            decoration: BoxDecoration(
                                color: Colors.grey.shade100),
                            children: const [
                              _TH('#'),
                              _TH('Name'),
                              _TH('Email'),
                              _TH('Department'),
                              _TH('Device'),
                              _TH('Last Login'),
                              _TH('Actions'),
                            ],
                          ),
                          ...lecturers.asMap().entries.map((e) {
                            final i = e.key;
                            final l = e.value;
                            final bg = i.isEven
                                ? Colors.white
                                : Colors.grey.shade50;
                            return TableRow(
                              decoration:
                                  BoxDecoration(color: bg),
                              children: [
                                _TC('${i + 1}',
                                    color: Colors.grey.shade500),
                                _TC(l.name, bold: true),
                                _TC(l.email),
                                _TC(l.department ?? '—',
                                    color: l.department == null
                                        ? Colors.grey
                                        : null),
                                Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: l.isDeviceLocked
                                      ? Row(children: [
                                          const Icon(Icons.lock,
                                              size: 14,
                                              color: Colors.green),
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
                                  l.lastLogin != null
                                      ? DateFormat('MMM d, yy')
                                          .format(l.lastLogin!)
                                      : 'Never',
                                  color: l.lastLogin != null
                                      ? null
                                      : Colors.grey,
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 8, horizontal: 8),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (l.isDeviceLocked)
                                        Tooltip(
                                          message: 'Reset Device Lock',
                                          child: IconButton(
                                            icon: const Icon(
                                                Icons.phone_android,
                                                size: 18,
                                                color:
                                                    Colors.orange),
                                            onPressed: () =>
                                                _resetDevice(
                                                    l.uid, l.name),
                                            padding:
                                                EdgeInsets.zero,
                                            constraints:
                                                const BoxConstraints(),
                                          ),
                                        ),
                                      const SizedBox(width: 8),
                                      Tooltip(
                                        message: 'Delete Lecturer',
                                        child: IconButton(
                                          icon: const Icon(
                                              Icons.delete,
                                              size: 18,
                                              color: Colors.red),
                                          onPressed: () =>
                                              _deleteLecturer(
                                                  l.uid, l.name),
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

  Future<void> _showAddLecturerDialog() async {
    final uidCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final deptCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Lecturer'),
        content: SizedBox(
          width: 400,
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Create the lecturer in Firebase Auth first, then add their UID here.',
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
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Full Name',
                      hintText: 'Dr. John Smith'),
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
                const SizedBox(height: 12),
                TextFormField(
                  controller: deptCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Department (optional)',
                      hintText: 'Computer Science'),
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
                await _firestoreService.addLecturer(
                  uid: uidCtrl.text.trim(),
                  name: nameCtrl.text.trim(),
                  email: emailCtrl.text.trim(),
                  department: deptCtrl.text.trim().isEmpty
                      ? null
                      : deptCtrl.text.trim(),
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Lecturer added.'),
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

  Future<void> _resetDevice(String uid, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Device Lock'),
        content: Text(
            'Remove device lock for $name? They can log in on a new device.'),
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
        await _firestoreService.resetLecturerDevice(uid);
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

  Future<void> _deleteLecturer(String uid, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Lecturer'),
        content: Text('Permanently delete $name from the database?'),
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
        await _firestoreService.deleteLecturer(uid);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Lecturer deleted.')));
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
