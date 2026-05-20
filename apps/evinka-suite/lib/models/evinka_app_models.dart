class EvinkaUser {
  final String id;
  final String name;
  final String email;
  final String employeeCode;
  final String role;
  final String status;

  const EvinkaUser({
    required this.id,
    required this.name,
    required this.email,
    this.employeeCode = '',
    required this.role,
    this.status = 'active',
  });

  String get normalizedRole => role.trim().toLowerCase();
  String get normalizedRoleKey =>
      normalizedRole.replaceAll(RegExp(r'[\s-]+'), '_');
  String get normalizedEmail => email.trim().toLowerCase();

  bool get isAdmin => normalizedRole == 'admin';
  bool get isLuisSupervisor => normalizedEmail == 'luis.campos@evinka.tech';
  bool get isTechSupervisor => const {
        'tecnico_supervisor',
        'supervisor_tecnico',
        'tech_supervisor',
        'technical_supervisor',
        'supervisor',
      }.contains(normalizedRoleKey);
  bool get hasFullAccess => isAdmin || isLuisSupervisor;
  bool get isCommercial => const {
        'comercial',
        'asesor_comercial',
        'asesor_venta',
        'kam_b2c',
        'kam',
        'asesor_ventas',
        'ventas',
        'venta',
        'sales',
        'commercial',
        'sales_advisor',
      }.contains(normalizedRoleKey);
  bool get isAdvisor => const {
        'asesor',
        'asesor_comercial',
        'asesor_venta',
        'asesor_humano',
        'advisor',
        'human_advisor',
      }.contains(normalizedRoleKey);
  bool get isInstaller => const {
        'instalador',
        'installer',
        'tecnico_instalador',
      }.contains(normalizedRoleKey);
  bool get isVisitTech => const {
        'tech',
        'tecnico',
        'tecnico_visita',
        'tecnico_visitas',
        'visit_tech',
        'field_tech',
      }.contains(normalizedRoleKey);
  bool get isTech =>
      isTechSupervisor ||
      isVisitTech ||
      isInstaller ||
      (!isAdmin && !isCommercial && !isAdvisor);
  bool get canSeeCommercialData =>
      hasFullAccess || isCommercial || isTechSupervisor;
  bool get canCreateQuotes =>
      hasFullAccess || isCommercial || isTechSupervisor || isVisitTech;
  bool get canViewQuotes => canCreateQuotes;
  bool get canEditCommercialFlow =>
      hasFullAccess || isCommercial || isTechSupervisor;
  bool get canReviewConformityFlow =>
      hasFullAccess || isCommercial || isTechSupervisor || isInstaller;

  factory EvinkaUser.fromJson(Map<String, dynamic> json) {
    return EvinkaUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      employeeCode: json['employeeCode']?.toString() ?? '',
      role: json['role']?.toString() ?? 'tech',
      status: json['status']?.toString() ?? 'active',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'employeeCode': employeeCode,
        'role': role,
        'status': status,
      };
}

class DistanceFactor {
  final double upto;
  final double factor;

  const DistanceFactor({required this.upto, required this.factor});

  factory DistanceFactor.fromJson(Map<String, dynamic> json) {
    return DistanceFactor(
      upto: (json['upto'] as num?)?.toDouble() ?? 0,
      factor: (json['factor'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'upto': upto.isInfinite ? 'Infinity' : upto,
        'factor': factor,
      };

  DistanceFactor copyWith({double? upto, double? factor}) {
    return DistanceFactor(
      upto: upto ?? this.upto,
      factor: factor ?? this.factor,
    );
  }
}

class EvinkaDefaults {
  final double igv;
  final double factorGeneralCosts;
  final double divisorMargin;
  final double chargerExchangeRate;
  final double miniboxPriceUsd;
  final double alienPriceUsd;
  final double max6mm;
  final double max10mm;
  final double includedMetersCasa;
  final double minimumCasa;
  final double includedMetersEdificio;
  final double minimumEdificio;
  final List<DistanceFactor> distanceFactors;

  const EvinkaDefaults({
    required this.igv,
    required this.factorGeneralCosts,
    required this.divisorMargin,
    required this.chargerExchangeRate,
    required this.miniboxPriceUsd,
    required this.alienPriceUsd,
    required this.max6mm,
    required this.max10mm,
    required this.includedMetersCasa,
    required this.minimumCasa,
    required this.includedMetersEdificio,
    required this.minimumEdificio,
    required this.distanceFactors,
  });

  factory EvinkaDefaults.fromJson(Map<String, dynamic> json) {
    final factors = (json['distanceFactors'] as List<dynamic>? ?? [])
        .map(
            (e) => DistanceFactor.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    return EvinkaDefaults(
      igv: (json['igv'] as num?)?.toDouble() ?? 0.18,
      factorGeneralCosts: (json['factorGeneralCosts'] as num?)?.toDouble() ?? 1,
      divisorMargin: (json['divisorMargin'] as num?)?.toDouble() ?? 0.75,
      chargerExchangeRate:
          (json['chargerExchangeRate'] as num?)?.toDouble() ?? 3.75,
      miniboxPriceUsd: (json['miniboxPriceUsd'] as num?)?.toDouble() ?? 700,
      alienPriceUsd: (json['alienPriceUsd'] as num?)?.toDouble() ?? 900,
      max6mm: (json['max6mm'] as num?)?.toDouble() ?? 25,
      max10mm: (json['max10mm'] as num?)?.toDouble() ?? 40,
      includedMetersCasa:
          (json['includedMetersCasa'] as num?)?.toDouble() ?? 10,
      minimumCasa: (json['minimumCasa'] as num?)?.toDouble() ?? 1499,
      includedMetersEdificio:
          (json['includedMetersEdificio'] as num?)?.toDouble() ?? 20,
      minimumEdificio: (json['minimumEdificio'] as num?)?.toDouble() ?? 1799,
      distanceFactors: factors,
    );
  }

  Map<String, dynamic> toJson() => {
        'igv': igv,
        'factorGeneralCosts': factorGeneralCosts,
        'divisorMargin': divisorMargin,
        'chargerExchangeRate': chargerExchangeRate,
        'miniboxPriceUsd': miniboxPriceUsd,
        'alienPriceUsd': alienPriceUsd,
        'max6mm': max6mm,
        'max10mm': max10mm,
        'includedMetersCasa': includedMetersCasa,
        'minimumCasa': minimumCasa,
        'includedMetersEdificio': includedMetersEdificio,
        'minimumEdificio': minimumEdificio,
        'distanceFactors': distanceFactors.map((e) => e.toJson()).toList(),
      };

  EvinkaDefaults copyWith({
    double? igv,
    double? factorGeneralCosts,
    double? divisorMargin,
    double? chargerExchangeRate,
    double? miniboxPriceUsd,
    double? alienPriceUsd,
    double? max6mm,
    double? max10mm,
    double? includedMetersCasa,
    double? minimumCasa,
    double? includedMetersEdificio,
    double? minimumEdificio,
    List<DistanceFactor>? distanceFactors,
  }) {
    return EvinkaDefaults(
      igv: igv ?? this.igv,
      factorGeneralCosts: factorGeneralCosts ?? this.factorGeneralCosts,
      divisorMargin: divisorMargin ?? this.divisorMargin,
      chargerExchangeRate: chargerExchangeRate ?? this.chargerExchangeRate,
      miniboxPriceUsd: miniboxPriceUsd ?? this.miniboxPriceUsd,
      alienPriceUsd: alienPriceUsd ?? this.alienPriceUsd,
      max6mm: max6mm ?? this.max6mm,
      max10mm: max10mm ?? this.max10mm,
      includedMetersCasa: includedMetersCasa ?? this.includedMetersCasa,
      minimumCasa: minimumCasa ?? this.minimumCasa,
      includedMetersEdificio:
          includedMetersEdificio ?? this.includedMetersEdificio,
      minimumEdificio: minimumEdificio ?? this.minimumEdificio,
      distanceFactors: distanceFactors ?? this.distanceFactors,
    );
  }
}

class CommercialProfile {
  final String id;
  final String name;
  final double marginPercent;
  final bool isDefault;

  const CommercialProfile({
    required this.id,
    required this.name,
    required this.marginPercent,
    required this.isDefault,
  });

  factory CommercialProfile.fromJson(Map<String, dynamic> json) {
    return CommercialProfile(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      marginPercent: (json['marginPercent'] as num?)?.toDouble() ?? 25,
      isDefault: json['isDefault'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'marginPercent': marginPercent,
        'isDefault': isDefault,
      };

  CommercialProfile copyWith({
    String? id,
    String? name,
    double? marginPercent,
    bool? isDefault,
  }) {
    return CommercialProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      marginPercent: marginPercent ?? this.marginPercent,
      isDefault: isDefault ?? this.isDefault,
    );
  }
}

class CatalogItem {
  final String code;
  final String section;
  final String nature;
  final String label;
  final String unit;
  final String description;
  final double costBase;
  final double costAdjusted;
  final double margin;
  final double priceWithMargin;
  final String rule;

  const CatalogItem({
    required this.code,
    required this.section,
    required this.nature,
    required this.label,
    required this.unit,
    required this.description,
    required this.costBase,
    required this.costAdjusted,
    required this.margin,
    required this.priceWithMargin,
    required this.rule,
  });

  factory CatalogItem.fromJson(Map<String, dynamic> json) {
    return CatalogItem(
      code: json['code']?.toString() ?? '',
      section: json['section']?.toString() ?? '',
      nature: json['nature']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      unit: json['unit']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      costBase: (json['costBase'] as num?)?.toDouble() ?? 0,
      costAdjusted: (json['costAdjusted'] as num?)?.toDouble() ?? 0,
      margin: (json['margin'] as num?)?.toDouble() ?? 0,
      priceWithMargin:
          ((json['priceWithMargin'] ?? json['price']) as num?)?.toDouble() ?? 0,
      rule: json['rule']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'code': code,
        'section': section,
        'nature': nature,
        'label': label,
        'unit': unit,
        'description': description,
        'costBase': costBase,
        'costAdjusted': costAdjusted,
        'margin': margin,
        'priceWithMargin': priceWithMargin,
        'price': priceWithMargin,
        'rule': rule,
      };

  CatalogItem copyWith({double? costBase}) {
    return CatalogItem(
      code: code,
      section: section,
      nature: nature,
      label: label,
      unit: unit,
      description: description,
      costBase: costBase ?? this.costBase,
      costAdjusted: costAdjusted,
      margin: margin,
      priceWithMargin: priceWithMargin,
      rule: rule,
    );
  }
}

class CableOption {
  final String id;
  final String code;
  final String label;
  final double pricePerMeter;

  const CableOption({
    required this.id,
    required this.code,
    required this.label,
    required this.pricePerMeter,
  });

  factory CableOption.fromJson(Map<String, dynamic> json) {
    return CableOption(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      pricePerMeter:
          ((json['pricePerMeter'] ?? json['price']) as num?)?.toDouble() ?? 0,
    );
  }
}

class ConditionalItem {
  final String id;
  final String code;
  final String section;
  final String unit;
  final String description;
  final double price;

  const ConditionalItem({
    required this.id,
    required this.code,
    required this.section,
    required this.unit,
    required this.description,
    required this.price,
  });

  factory ConditionalItem.fromJson(Map<String, dynamic> json) {
    return ConditionalItem(
      id: json['id']?.toString() ?? json['code']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      section: json['section']?.toString() ?? '',
      unit: json['unit']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      price:
          ((json['price'] ?? json['priceWithMargin']) as num?)?.toDouble() ?? 0,
    );
  }
}

class EvinkaCatalog {
  final List<CatalogItem> items;
  final List<CableOption> cables;
  final List<ConditionalItem> conditionals;

  const EvinkaCatalog({
    required this.items,
    required this.cables,
    required this.conditionals,
  });

  factory EvinkaCatalog.fromJson(Map<String, dynamic> json) {
    return EvinkaCatalog(
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => CatalogItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      cables: (json['cables'] as List<dynamic>? ?? [])
          .map((e) => CableOption.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      conditionals: (json['conditionals'] as List<dynamic>? ?? [])
          .map((e) =>
              ConditionalItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'items': items.map((e) => e.toJson()).toList(),
        'cables': cables
            .map((e) => {
                  'id': e.id,
                  'code': e.code,
                  'label': e.label,
                  'pricePerMeter': e.pricePerMeter,
                })
            .toList(),
        'conditionals': conditionals
            .map((e) => {
                  'id': e.id,
                  'code': e.code,
                  'section': e.section,
                  'unit': e.unit,
                  'description': e.description,
                  'price': e.price,
                })
            .toList(),
      };

  EvinkaCatalog copyWith({List<CatalogItem>? items}) {
    return EvinkaCatalog(
      items: items ?? this.items,
      cables: cables,
      conditionals: conditionals,
    );
  }
}

class EvinkaConfig {
  final String companyName;
  final String companyTagline;
  final EvinkaDefaults defaults;
  final List<CommercialProfile> commercialProfiles;
  final EvinkaCatalog catalog;
  final List<String> roles;

  const EvinkaConfig({
    required this.companyName,
    required this.companyTagline,
    required this.defaults,
    required this.commercialProfiles,
    required this.catalog,
    required this.roles,
  });

  factory EvinkaConfig.fromJson(Map<String, dynamic> json) {
    final company = Map<String, dynamic>.from(json['company'] as Map? ?? {});
    return EvinkaConfig(
      companyName: company['name']?.toString() ?? 'EVINKA',
      companyTagline: company['tagline']?.toString() ?? '',
      defaults: EvinkaDefaults.fromJson(
          Map<String, dynamic>.from(json['defaults'] as Map? ?? {})),
      commercialProfiles: (json['commercialProfiles'] as List<dynamic>? ?? [])
          .map((e) =>
              CommercialProfile.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      catalog: EvinkaCatalog.fromJson(
          Map<String, dynamic>.from(json['catalog'] as Map? ?? {})),
      roles: (json['roles'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'company': {
          'name': companyName,
          'tagline': companyTagline,
        },
        'defaults': defaults.toJson(),
        'commercialProfiles':
            commercialProfiles.map((e) => e.toJson()).toList(),
        'catalog': {
          'items': catalog.items.map((e) => e.toJson()).toList(),
        },
      };

  EvinkaConfig copyWith({
    String? companyName,
    String? companyTagline,
    EvinkaDefaults? defaults,
    List<CommercialProfile>? commercialProfiles,
    EvinkaCatalog? catalog,
  }) {
    return EvinkaConfig(
      companyName: companyName ?? this.companyName,
      companyTagline: companyTagline ?? this.companyTagline,
      defaults: defaults ?? this.defaults,
      commercialProfiles: commercialProfiles ?? this.commercialProfiles,
      catalog: catalog ?? this.catalog,
      roles: roles,
    );
  }
}

class QuoteRecord {
  final String id;
  final String clientName;
  final String email;
  final String clientDocument;
  final String status;
  final String conformityStatus;
  final String installationOrderId;
  final String installationType;
  final String propertyType;
  final String createdAt;
  final double total;
  final double subtotal;
  final double igv;
  final double marginPercent;
  final String pdfPath;
  final String pdfFilename;
  final String profileName;
  final String emailStatusMessage;
  final bool emailSent;
  final String scheduledInstallationAt;
  final String scheduledInstallationWindow;
  final List<dynamic> includedScope;

  const QuoteRecord({
    required this.id,
    required this.clientName,
    required this.email,
    required this.clientDocument,
    required this.status,
    required this.conformityStatus,
    required this.installationOrderId,
    required this.installationType,
    required this.propertyType,
    required this.createdAt,
    required this.total,
    required this.subtotal,
    required this.igv,
    required this.marginPercent,
    required this.pdfPath,
    required this.pdfFilename,
    required this.profileName,
    required this.emailStatusMessage,
    required this.emailSent,
    required this.scheduledInstallationAt,
    required this.scheduledInstallationWindow,
    required this.includedScope,
  });

  String get normalizedStatus => status.trim().toLowerCase();
  String get normalizedConformityStatus =>
      conformityStatus.trim().toLowerCase();
  bool get hasOrder => installationOrderId.isNotEmpty;
  bool get hasGeneratedConformity =>
      normalizedConformityStatus == 'pdf_generated';
  bool get hasScheduledInstallation =>
      scheduledInstallationAt.trim().isNotEmpty;
  bool get canConfirmForSend => normalizedStatus == 'cotizada';
  bool get canMarkClientAccepted => normalizedStatus == 'lista_envio';
  bool get canRequestRecotizar => normalizedStatus == 'lista_envio';
  bool get canCancel =>
      ['cotizada', 'lista_envio', 'recotizar'].contains(normalizedStatus);
  bool get canScheduleInstallation =>
      normalizedStatus == 'aceptada_cliente' &&
      !hasGeneratedConformity &&
      !hasScheduledInstallation;
  bool get canMarkFullPayment =>
      hasGeneratedConformity && normalizedStatus != 'abono_100_confirmado';
  bool get canOpenConformity =>
      hasOrder && (normalizedStatus == 'instalada' || hasGeneratedConformity);

  String get statusLabel {
    if (normalizedStatus == 'abono_100_confirmado') {
      return 'Proyecto cerrado';
    }
    if (hasGeneratedConformity) {
      return 'Conformidad generada';
    }
    switch (normalizedStatus) {
      case 'instalada':
        return 'Instalada';
      case 'aceptada':
      case 'aceptada_cliente':
        return 'Abono 50% confirmado';
      case 'lista_envio':
        return 'Lista para enviar';
      case 'recotizar':
        return 'Recotizar';
      case 'cancelada':
        return 'Cancelada';
      default:
        return 'Pendiente comercial';
    }
  }

  factory QuoteRecord.fromJson(Map<String, dynamic> json) {
    final profile =
        Map<String, dynamic>.from(json['commercialProfile'] as Map? ?? {});
    final emailDelivery =
        Map<String, dynamic>.from(json['emailDelivery'] as Map? ?? {});
    return QuoteRecord(
      id: json['id']?.toString() ?? '',
      clientName: json['clientName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      clientDocument: json['clientDocument']?.toString() ?? '',
      status: json['status']?.toString() ?? 'cotizada',
      conformityStatus: json['conformityStatus']?.toString() ?? 'not_started',
      installationOrderId: json['installationOrderId']?.toString() ?? '',
      installationType: json['installationType']?.toString() ?? '',
      propertyType: json['propertyType']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      total: (json['total'] as num?)?.toDouble() ?? 0,
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
      igv: (json['igv'] as num?)?.toDouble() ?? 0,
      marginPercent: (json['marginPercent'] as num?)?.toDouble() ?? 0,
      pdfPath: json['pdfPath']?.toString() ?? '',
      pdfFilename: json['pdfFilename']?.toString() ?? '',
      profileName: profile['name']?.toString() ?? 'GENERAL',
      emailStatusMessage: emailDelivery['message']?.toString() ?? '',
      emailSent: emailDelivery['ok'] == true,
      scheduledInstallationAt:
          json['scheduledInstallationAt']?.toString() ?? '',
      scheduledInstallationWindow:
          json['scheduledInstallationWindow']?.toString() ?? '',
      includedScope: (json['includedScope'] as List<dynamic>? ?? const []),
    );
  }
}

class TechVisit {
  final String id;
  final String source;
  final String type;
  final String status;
  final String clientName;
  final String clientPhone;
  final String clientDocument;
  final String clientEmail;
  final String clientAddress;
  final String scheduledAt;
  final String timeWindow;
  final String notes;
  final String resolution;
  final String reference;
  final String quoteId;
  final String installationOrderId;
  final String assignedTechEmail;
  final String assignedTechName;
  final List<String> checklist;
  final String createdAt;
  final String updatedAt;
  final String startedAt;
  final String closedAt;

  const TechVisit({
    required this.id,
    required this.source,
    required this.type,
    required this.status,
    required this.clientName,
    required this.clientPhone,
    required this.clientDocument,
    required this.clientEmail,
    required this.clientAddress,
    required this.scheduledAt,
    required this.timeWindow,
    required this.notes,
    required this.resolution,
    required this.reference,
    required this.quoteId,
    required this.installationOrderId,
    required this.assignedTechEmail,
    required this.assignedTechName,
    required this.checklist,
    required this.createdAt,
    required this.updatedAt,
    required this.startedAt,
    required this.closedAt,
  });

  bool get isClosed => status == 'cerrada';
  bool get isPendingClose => status == 'pendiente_cierre';
  bool get needsAction => !isClosed;
  bool get isExpiredUnattended {
    final dt = scheduledDate;
    if (dt == null) return false;
    final now = DateTime.now();
    final scheduledDay = DateTime(dt.year, dt.month, dt.day);
    final today = DateTime(now.year, now.month, now.day);
    if (!scheduledDay.isBefore(today)) return false;
    return const {
      'pendiente',
      'agendada',
      'en_ruta',
      'en_visita',
    }.contains(status);
  }

  bool get hideFromBoard => isExpiredUnattended;
  bool get isVisibleOnBoard => !hideFromBoard;
  bool get isToday {
    final dt = scheduledDate;
    if (dt == null || hideFromBoard) return false;
    final now = DateTime.now();
    return dt.year == now.year && dt.month == now.month && dt.day == now.day;
  }

  bool get isThisWeek {
    final dt = scheduledDate;
    if (dt == null || hideFromBoard) return false;
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
    final end = start.add(const Duration(days: 7));
    return !dt.isBefore(start) && dt.isBefore(end);
  }

  bool get isThisMonth {
    final dt = scheduledDate;
    if (dt == null || hideFromBoard) return false;
    final now = DateTime.now();
    return dt.year == now.year && dt.month == now.month;
  }

  bool get needsQuote =>
      status == 'recotizar' ||
      (!hasQuote &&
          [
            'agendada',
            'en_ruta',
            'en_visita',
            'visitada',
            'pendiente_cotizacion',
            'reprogramada',
            'pendiente',
          ].contains(status));
  bool get hasQuote => quoteId.isNotEmpty;
  bool get hasOrder => installationOrderId.isNotEmpty;
  bool get isInstallation => type == 'instalacion';
  String get typeLabel =>
      isInstallation ? 'Instalación' : 'Evaluación / visita';
  bool get needsQuoteConfirmation => status == 'cotizada';
  bool get pendingCommercialReview =>
      status == 'pendiente_cotizacion' || status == 'cotizada';
  bool get needsClientDecision => status == 'lista_envio';
  bool get needsScheduling => status == 'aceptada_cliente';
  bool get needsConformity => status == 'pendiente_conformidad';
  bool get canMarkVisitCompleted => !isInstallation && status == 'en_visita';
  bool get canMarkInstallationCompleted =>
      isInstallation && status == 'en_visita';

  DateTime? get scheduledDate {
    final parsed = DateTime.tryParse(scheduledAt);
    if (parsed == null) return null;
    return parsed.toLocal();
  }

  bool get isHappeningNow {
    final dt = scheduledDate;
    if (dt == null || isClosed || hideFromBoard) return false;
    final now = DateTime.now();
    final end = dt.add(const Duration(hours: 1));
    return now.isAfter(dt.subtract(const Duration(minutes: 30))) &&
        now.isBefore(end);
  }

  bool get isUpcomingSoon {
    final dt = scheduledDate;
    if (dt == null || isClosed || hideFromBoard) return false;
    final now = DateTime.now();
    return dt.isAfter(now) && dt.isBefore(now.add(const Duration(hours: 3)));
  }

  String get nextActionLabel {
    if (status == 'agendada') return 'Ir en ruta';
    if (status == 'en_ruta') return 'Marcar en visita';
    if (needsQuote) return 'Cotizar';
    if (pendingCommercialReview) return 'Pendiente comercial';
    if (needsClientDecision) return 'Registrar respuesta';
    if (needsScheduling) return 'Agendar instalación';
    if (canMarkInstallationCompleted) return 'Marcar instalada';
    if (canMarkVisitCompleted) return 'Marcar visitada';
    if (needsConformity) return 'Abrir conformidad';
    if (isPendingClose || status == 'visitada') return 'Cerrar visita';
    if (status == 'en_visita') return 'Registrar visita';
    return 'Abrir visita';
  }

  String get statusLabel {
    switch (status) {
      case 'agendada':
        return 'Agendada';
      case 'en_ruta':
        return 'En ruta';
      case 'en_visita':
        return 'En visita';
      case 'visitada':
        return 'Visitada';
      case 'cotizada':
        return 'Cotizada';
      case 'pendiente_cotizacion':
        return 'Pendiente de cotización';
      case 'lista_envio':
        return 'Lista para enviar';
      case 'aceptada_cliente':
        return 'Abono 50% confirmado';
      case 'cancelada':
        return 'Cotización cancelada';
      case 'recotizar':
        return 'Recotizar';
      case 'pendiente_conformidad':
        return 'Pendiente de conformidad';
      case 'pendiente_cierre':
        return 'Pendiente de cierre';
      case 'reprogramada':
        return 'Reprogramada';
      case 'cerrada':
        return 'Cerrada';
      default:
        return 'Pendiente';
    }
  }

  factory TechVisit.fromJson(Map<String, dynamic> json) {
    return TechVisit(
      id: json['id']?.toString() ?? '',
      source: json['source']?.toString() ?? 'chatbot',
      type: json['type']?.toString() ?? 'visita_tecnica',
      status: json['status']?.toString() ?? 'pendiente',
      clientName: json['clientName']?.toString() ?? '',
      clientPhone: json['clientPhone']?.toString() ?? '',
      clientDocument: json['clientDocument']?.toString() ?? '',
      clientEmail: json['clientEmail']?.toString() ?? '',
      clientAddress: json['clientAddress']?.toString() ?? '',
      scheduledAt: json['scheduledAt']?.toString() ?? '',
      timeWindow: json['timeWindow']?.toString() ?? '',
      notes: json['notes']?.toString() ?? '',
      resolution: json['resolution']?.toString() ?? '',
      reference: json['reference']?.toString() ?? '',
      quoteId: json['quoteId']?.toString() ?? '',
      installationOrderId: json['installationOrderId']?.toString() ?? '',
      assignedTechEmail: json['assignedTechEmail']?.toString() ?? '',
      assignedTechName: json['assignedTechName']?.toString() ?? '',
      checklist: (json['checklist'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
      startedAt: json['startedAt']?.toString() ?? '',
      closedAt: json['closedAt']?.toString() ?? '',
    );
  }
}

class DraftSitePhoto {
  final String id;
  final String name;
  final String mimeType;
  final List<int> bytes;
  final String title;
  final String comment;

  const DraftSitePhoto({
    required this.id,
    required this.name,
    required this.mimeType,
    required this.bytes,
    this.title = '',
    this.comment = '',
  });

  DraftSitePhoto copyWith({String? title, String? comment}) {
    return DraftSitePhoto(
      id: id,
      name: name,
      mimeType: mimeType,
      bytes: bytes,
      title: title ?? this.title,
      comment: comment ?? this.comment,
    );
  }
}
