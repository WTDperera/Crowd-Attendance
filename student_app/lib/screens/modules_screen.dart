import 'package:flutter/material.dart';

import '../models/module.dart';
import '../services/module_service.dart';

class ModulesScreen extends StatefulWidget {
  const ModulesScreen({super.key, required this.studentUid, this.service});

  final String studentUid;
  final ModuleService? service;

  @override
  State<ModulesScreen> createState() => _ModulesScreenState();
}

class _ModulesScreenState extends State<ModulesScreen> {
  late final ModuleService _service;
  final Set<String> _enrollingCodes = <String>{};

  static const double _cardPadding = 16;
  static const double _actionHeight = 44;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? ModuleService();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D1E33),
        elevation: 0,
        title: const Text('All Modules'),
      ),
      body: StreamBuilder<Set<String>>(
        stream: _service.watchEnrolledCodes(widget.studentUid),
        builder: (context, myEnrollmentsSnap) {
          if (myEnrollmentsSnap.hasError) {
            return _ErrorState(message: myEnrollmentsSnap.error.toString());
          }

          if (myEnrollmentsSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final myEnrollmentCodes = myEnrollmentsSnap.data ?? <String>{};

          return StreamBuilder<List<Module>>(
            stream: _service.watchAllModules(),
            builder: (context, modulesSnap) {
              if (modulesSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (modulesSnap.hasError) {
                return _ErrorState(message: modulesSnap.error.toString());
              }

              final modules = modulesSnap.data ?? const <Module>[];
              if (modules.isEmpty) {
                return Center(
                  child: Text(
                    'No modules available.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: modules.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final module = modules[index];
                  final moduleCode = module.code.trim().isNotEmpty
                      ? module.code.trim()
                      : module.id.trim();
                  final enrolled = myEnrollmentCodes.contains(moduleCode);

                  final isClosed = !module.enrollmentEnabled;
                  final isLoading = _enrollingCodes.contains(moduleCode);

                  final scheme = Theme.of(context).colorScheme;

                  final name = module.name.trim().isNotEmpty
                      ? module.name
                      : 'Module';

                  final status = enrolled
                      ? _ModuleStatus.enrolled
                      : (isClosed ? _ModuleStatus.closed : _ModuleStatus.open);

                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(_cardPadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      moduleCode,
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineMedium
                                          ?.copyWith(fontSize: 18),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      name,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodyMedium,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    if (module.totalSessions > 0) ...[
                                      const SizedBox(height: 6),
                                      Text(
                                        'Total sessions: ${module.totalSessions}',
                                        style: Theme.of(
                                          context,
                                        ).textTheme.bodySmall,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              _StatusChip(status: status),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Spacer(),
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  minWidth: 128,
                                ),
                                child: SizedBox(
                                  height: _actionHeight,
                                  child: ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: enrolled
                                          ? Colors.green
                                          : (isClosed
                                                ? Colors.redAccent
                                                : scheme.primary),
                                      foregroundColor: Colors.white,
                                      disabledBackgroundColor:
                                          (enrolled
                                                  ? Colors.green
                                                  : (isClosed
                                                        ? Colors.redAccent
                                                        : scheme.primary))
                                              .withAlpha(210),
                                      disabledForegroundColor: Colors.white
                                          .withAlpha(235),
                                      textStyle: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.w700,
                                          ),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 16,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    onPressed:
                                        (enrolled || isClosed || isLoading)
                                        ? null
                                        : () async {
                                            setState(() {
                                              _enrollingCodes.add(moduleCode);
                                            });
                                            try {
                                              final plain =
                                                  await _promptForPassword(
                                                    context,
                                                  );
                                              if (plain == null) return;

                                              if (plain.trim().isEmpty) {
                                                if (!context.mounted) {
                                                  return;
                                                }
                                                ScaffoldMessenger.of(
                                                  context,
                                                ).showSnackBar(
                                                  const SnackBar(
                                                    content: Text(
                                                      'Password is required',
                                                    ),
                                                    backgroundColor: Colors.red,
                                                  ),
                                                );
                                                return;
                                              }

                                              await _service.enrollWithPassword(
                                                studentUid: widget.studentUid,
                                                module: module,
                                                plainPassword: plain,
                                              );
                                              if (!context.mounted) {
                                                return;
                                              }
                                              ScaffoldMessenger.of(
                                                context,
                                              ).showSnackBar(
                                                SnackBar(
                                                  content: Text(
                                                    'Enrolled in $moduleCode',
                                                  ),
                                                  backgroundColor: Colors.green,
                                                ),
                                              );
                                            } catch (e) {
                                              if (!context.mounted) {
                                                return;
                                              }
                                              final msg =
                                                  (e
                                                      is WrongEnrollmentPasswordException)
                                                  ? 'Wrong password'
                                                  : e.toString();
                                              ScaffoldMessenger.of(
                                                context,
                                              ).showSnackBar(
                                                SnackBar(
                                                  content: Text(msg),
                                                  backgroundColor: Colors.red,
                                                ),
                                              );
                                            } finally {
                                              if (mounted) {
                                                setState(() {
                                                  _enrollingCodes.remove(
                                                    moduleCode,
                                                  );
                                                });
                                              }
                                            }
                                          },
                                    icon: isLoading
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    Colors.white,
                                                  ),
                                            ),
                                          )
                                        : Icon(
                                            enrolled
                                                ? Icons.check
                                                : (isClosed
                                                      ? Icons.lock
                                                      : Icons.add),
                                          ),
                                    label: Text(
                                      enrolled
                                          ? 'Enrolled'
                                          : (isClosed ? 'Closed' : 'Enroll'),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

enum _ModuleStatus { open, enrolled, closed }

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final _ModuleStatus status;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (text, bg, fg, icon) = switch (status) {
      _ModuleStatus.enrolled => (
        'Enrolled',
        Colors.green,
        Colors.white,
        Icons.verified,
      ),
      _ModuleStatus.closed => (
        'Closed',
        Colors.redAccent,
        Colors.white,
        Icons.lock,
      ),
      _ModuleStatus.open => (
        'Open',
        scheme.surface,
        Colors.white70,
        Icons.circle,
      ),
    };

    return Chip(
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      labelPadding: const EdgeInsets.symmetric(horizontal: 6),
      padding: EdgeInsets.zero,
      avatar: Icon(icon, size: 16, color: fg),
      label: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
      backgroundColor: bg,
      side: BorderSide(color: Colors.white.withAlpha(25)),
    );
  }
}

Future<String?> _promptForPassword(BuildContext context) async {
  var password = '';
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (context) {
      return AlertDialog(
        title: const Text('Enrollment Password'),
        content: TextField(
          obscureText: true,
          autocorrect: false,
          enableSuggestions: false,
          keyboardType: TextInputType.visiblePassword,
          autofillHints: const [AutofillHints.password],
          decoration: const InputDecoration(
            labelText: 'Password',
            hintText: 'Enter the module enrollment password',
          ),
          autofocus: true,
          textInputAction: TextInputAction.done,
          onChanged: (v) => password = v,
          onSubmitted: (v) => Navigator.of(context).pop(v),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(null),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(password),
            child: const Text('Continue'),
          ),
        ],
      );
    },
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          message,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: Colors.redAccent),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
