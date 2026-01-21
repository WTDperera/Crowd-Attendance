import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'features/ble/ble_controller.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => BleController()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Crowd Attendance',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    // Initialize BLE Controller after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BleController>().initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bleController = context.watch<BleController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Crowd Attendance'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Identity Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Secure Identity (MediaDrm)", style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    SelectableText(
                      bleController.deviceId ?? "Generating...",
                      style: const TextStyle(fontFamily: 'Monospace', fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Status Section
            Card(
              color: _getStateColor(bleController.currentState),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    const Icon(Icons.bluetooth, color: Colors.white),
                    const SizedBox(width: 16),
                    Text(
                      "State: ${bleController.currentState.name.toUpperCase()}",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Controls
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton.icon(
                  onPressed: () => bleController.startTdm(),
                  icon: const Icon(Icons.play_arrow),
                  label: const Text("Start Attendance"),
                ),
                ElevatedButton.icon(
                  onPressed: () => bleController.stopTdm(),
                  icon: const Icon(Icons.stop),
                  label: const Text("Stop"),
                  style: ElevatedButton.styleFrom(foregroundColor: Colors.red),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Logs
            const Text("Live Logs:", style: TextStyle(fontWeight: FontWeight.bold)),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.all(8),
                child: ListView.builder(
                  itemCount: bleController.logs.length,
                  itemBuilder: (context, index) {
                    // Show newest first
                    final log = bleController.logs[bleController.logs.length - 1 - index];
                    return Text(
                      log,
                      style: const TextStyle(color: Colors.greenAccent, fontSize: 10, fontFamily: 'Monospace'),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStateColor(BleState state) {
    switch (state) {
      case BleState.advertising:
        return Colors.blue;
      case BleState.scanning:
        return Colors.orange;
      case BleState.idle:
        return Colors.grey;
    }
  }
}
