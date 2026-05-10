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
}
