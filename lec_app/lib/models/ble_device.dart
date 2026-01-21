class DeviceModel {
  final String id;
  final String name;
  final String? advertisedUuid;
  String? regNo; // Populated after Firestore lookup

  DeviceModel({required this.id, required this.name, this.advertisedUuid, this.regNo});
}
