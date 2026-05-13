class InstallationOrderModel {
  final String id;
  final String quoteId;
  final String quoteNumber;
  final String clientName;
  final String clientEmail;
  final String clientPhone;
  final String clientDocument;
  final String city;
  final String address;
  final String installationType;
  final String propertyType;
  final String commercialProfileName;
  final String advisorName;
  final String assignedTechnician;
  final String quotePdfUrl;
  final String chargerBrand;
  final String voltage;
  final String amperage;
  final String powerKw;
  final String status;

  const InstallationOrderModel({
    required this.id,
    required this.quoteId,
    required this.quoteNumber,
    required this.clientName,
    required this.clientEmail,
    required this.clientPhone,
    required this.clientDocument,
    required this.city,
    required this.address,
    required this.installationType,
    required this.propertyType,
    required this.commercialProfileName,
    required this.advisorName,
    required this.assignedTechnician,
    required this.quotePdfUrl,
    required this.chargerBrand,
    required this.voltage,
    required this.amperage,
    required this.powerKw,
    required this.status,
  });

  factory InstallationOrderModel.fromJson(Map<String, dynamic> json) {
    return InstallationOrderModel(
      id: json['id']?.toString() ?? '',
      quoteId: json['quoteId']?.toString() ?? '',
      quoteNumber: json['quoteNumber']?.toString() ?? '',
      clientName: json['clientName']?.toString() ?? '',
      clientEmail: json['clientEmail']?.toString() ?? '',
      clientPhone: json['clientPhone']?.toString() ?? '',
      clientDocument: json['clientDocument']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      installationType: json['installationType']?.toString() ?? '',
      propertyType: json['propertyType']?.toString() ?? '',
      commercialProfileName: json['commercialProfileName']?.toString() ?? '',
      advisorName: json['advisorName']?.toString() ?? '',
      assignedTechnician: json['assignedTechnician']?.toString() ?? '',
      quotePdfUrl: json['quotePdfUrl']?.toString() ?? '',
      chargerBrand: json['chargerBrand']?.toString() ?? '',
      voltage: json['voltage']?.toString() ?? '',
      amperage: json['amperage']?.toString() ?? '',
      powerKw: json['powerKw']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
    );
  }
}
