class Device {
  const Device({
    required this.deviceId,
    required this.productId,
    required this.name,
    required this.online,
    this.iconUrl,
    this.firmwareVersion,
  });

  final String deviceId;
  final String productId;
  final String name;
  final bool online;
  final String? iconUrl;
  final String? firmwareVersion;

  Device copyWith({String? name, bool? online}) => Device(
    deviceId: deviceId,
    productId: productId,
    name: name ?? this.name,
    online: online ?? this.online,
    iconUrl: iconUrl,
    firmwareVersion: firmwareVersion,
  );
}
