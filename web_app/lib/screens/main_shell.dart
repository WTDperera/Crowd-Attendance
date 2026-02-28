import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'dashboard_screen.dart';
import 'sessions_screen.dart';
import 'students_screen.dart';
import 'lecturers_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;
  final _authService = AuthService();
  String _userName = '';

  final List<_NavItem> _navItems = [
    _NavItem(Icons.dashboard_outlined, Icons.dashboard, 'Dashboard'),
    _NavItem(Icons.event_outlined, Icons.event, 'Sessions'),
    _NavItem(Icons.school_outlined, Icons.school, 'Students'),
    _NavItem(Icons.person_outline, Icons.person, 'Lecturers'),
  ];

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final data = await _authService.getCurrentUserData();
    if (mounted && data != null) {
      setState(() {
        _userName = data['name'] ?? data['email'] ?? 'Admin';
      });
    }
  }

  void _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child:
                const Text('Sign Out', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _authService.logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      const DashboardScreen(),
      const SessionsScreen(),
      const StudentsScreen(),
      const LecturersScreen(),
    ];

    return Scaffold(
      body: Row(
        children: [
          // Sidebar
          Container(
            width: 220,
            color: const Color(0xFF0A0E21),
            child: Column(
              children: [
                // Header
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 40, 16, 24),
                  child: Column(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: [
                              Colors.cyan.shade400,
                              Colors.blue.shade700,
                            ],
                          ),
                        ),
                        child: const Icon(Icons.wifi_tethering,
                            color: Colors.white, size: 28),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'BLE Attendance',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      const Text(
                        'Admin Dashboard',
                        style:
                            TextStyle(color: Colors.cyan, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const Divider(color: Colors.white12, height: 1),
                const SizedBox(height: 12),
                // Nav items
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    itemCount: _navItems.length,
                    itemBuilder: (_, i) {
                      final item = _navItems[i];
                      final selected = _selectedIndex == i;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: ListTile(
                          leading: Icon(
                            selected ? item.activeIcon : item.icon,
                            color: selected
                                ? const Color(0xFF00BCD4)
                                : Colors.white54,
                            size: 22,
                          ),
                          title: Text(
                            item.label,
                            style: TextStyle(
                              color: selected
                                  ? const Color(0xFF00BCD4)
                                  : Colors.white70,
                              fontWeight: selected
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                              fontSize: 14,
                            ),
                          ),
                          selected: selected,
                          selectedTileColor:
                              const Color(0xFF1D1E33),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          onTap: () =>
                              setState(() => _selectedIndex = i),
                        ),
                      );
                    },
                  ),
                ),
                // Footer
                const Divider(color: Colors.white12, height: 1),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 16,
                        backgroundColor: Color(0xFF1D1E33),
                        child: Icon(Icons.person,
                            color: Colors.cyan, size: 18),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _userName,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.logout,
                            color: Colors.white38, size: 18),
                        tooltip: 'Sign Out',
                        onPressed: _handleLogout,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
          // Content
          Expanded(child: screens[_selectedIndex]),
        ],
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem(this.icon, this.activeIcon, this.label);
}
