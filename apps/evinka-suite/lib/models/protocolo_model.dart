class ProtocoloModel {
  String fecha;
  String quoteId;
  String installationOrderId;
  String commercialProfileName;
  String cliente;
  String clientEmail;
  String ruc;
  String direccion;
  String observaciones;
  String marca;
  String numeroSerie;
  String voltaje;
  String amperaje;
  String otro;
  String potenciaKw;
  bool cajaCargador;
  bool cargadorEvinka;
  bool manualCargador;
  bool tarjetasCargador;
  bool adicional;
  String adicionalDesc;
  List<int>? firmaInstalador;
  List<int>? firmaCliente;
  List<int>? foto1;
  List<int>? foto2;

  ProtocoloModel({
    this.fecha = '',
    this.quoteId = '',
    this.installationOrderId = '',
    this.commercialProfileName = '',
    this.cliente = '',
    this.clientEmail = '',
    this.ruc = '',
    this.direccion = '',
    this.observaciones = '',
    this.marca = '',
    this.numeroSerie = '',
    this.voltaje = '',
    this.amperaje = '',
    this.otro = '',
    this.potenciaKw = '',
    this.cajaCargador = false,
    this.cargadorEvinka = false,
    this.manualCargador = false,
    this.tarjetasCargador = false,
    this.adicional = false,
    this.adicionalDesc = '',
    this.firmaInstalador,
    this.firmaCliente,
    this.foto1,
    this.foto2,
  });

  factory ProtocoloModel.fromJson(Map<String, dynamic> json) {
    List<int>? bytesOf(dynamic value) {
      if (value is List) {
        return value.map((e) => (e as num).toInt()).toList();
      }
      return null;
    }

    return ProtocoloModel(
      fecha: json['fecha']?.toString() ?? '',
      quoteId: json['quoteId']?.toString() ?? '',
      installationOrderId: json['installationOrderId']?.toString() ?? '',
      commercialProfileName: json['commercialProfileName']?.toString() ?? '',
      cliente: json['cliente']?.toString() ?? '',
      clientEmail: json['clientEmail']?.toString() ?? '',
      ruc: json['ruc']?.toString() ?? '',
      direccion: json['direccion']?.toString() ?? '',
      observaciones: json['observaciones']?.toString() ?? '',
      marca: json['marca']?.toString() ?? '',
      numeroSerie: json['numeroSerie']?.toString() ?? '',
      voltaje: json['voltaje']?.toString() ?? '',
      amperaje: json['amperaje']?.toString() ?? '',
      otro: json['otro']?.toString() ?? '',
      potenciaKw: json['potenciaKw']?.toString() ?? '',
      cajaCargador: json['cajaCargador'] == true,
      cargadorEvinka: json['cargadorEvinka'] == true,
      manualCargador: json['manualCargador'] == true,
      tarjetasCargador: json['tarjetasCargador'] == true,
      adicional: json['adicional'] == true,
      adicionalDesc: json['adicionalDesc']?.toString() ?? '',
      firmaInstalador: bytesOf(json['firmaInstalador']),
      firmaCliente: bytesOf(json['firmaCliente']),
      foto1: bytesOf(json['foto1']),
      foto2: bytesOf(json['foto2']),
    );
  }

  Map<String, dynamic> toJson() => {
        'fecha': fecha,
        'quoteId': quoteId,
        'installationOrderId': installationOrderId,
        'commercialProfileName': commercialProfileName,
        'cliente': cliente,
        'clientEmail': clientEmail,
        'ruc': ruc,
        'direccion': direccion,
        'observaciones': observaciones,
        'marca': marca,
        'numeroSerie': numeroSerie,
        'voltaje': voltaje,
        'amperaje': amperaje,
        'otro': otro,
        'potenciaKw': potenciaKw,
        'cajaCargador': cajaCargador,
        'cargadorEvinka': cargadorEvinka,
        'manualCargador': manualCargador,
        'tarjetasCargador': tarjetasCargador,
        'adicional': adicional,
        'adicionalDesc': adicionalDesc,
        if (firmaInstalador != null) 'firmaInstalador': firmaInstalador,
        if (firmaCliente != null) 'firmaCliente': firmaCliente,
        if (foto1 != null) 'foto1': foto1,
        if (foto2 != null) 'foto2': foto2,
      };
}
