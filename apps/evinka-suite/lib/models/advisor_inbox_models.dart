class AdvisorInboxSummary {
  final String id;
  final String countryCode;
  final String customerName;
  final String phone;
  final String phonePretty;
  final String email;
  final String district;
  final String province;
  final String currentStep;
  final String handoffReason;
  final String whatsappState;
  final String status;
  final String? assignedTo;
  final String? assignedToLabel;
  final String? assignedAt;
  final int unreadCount;
  final List<String> tags;
  final String internalNote;
  final String nextAction;
  final String manualPriority;
  final String relatedVisitId;
  final String relatedQuoteId;
  final String lastMessageText;
  final String lastMessageAt;
  final String? lastIncomingAt;
  final String createdAt;
  final String updatedAt;
  final List<String> conversationIds;

  const AdvisorInboxSummary({
    required this.id,
    required this.countryCode,
    required this.customerName,
    required this.phone,
    required this.phonePretty,
    required this.email,
    required this.district,
    required this.province,
    required this.currentStep,
    required this.handoffReason,
    required this.whatsappState,
    required this.status,
    required this.assignedTo,
    required this.assignedToLabel,
    required this.assignedAt,
    required this.unreadCount,
    required this.tags,
    required this.internalNote,
    required this.nextAction,
    required this.manualPriority,
    required this.relatedVisitId,
    required this.relatedQuoteId,
    required this.lastMessageText,
    required this.lastMessageAt,
    required this.lastIncomingAt,
    required this.createdAt,
    required this.updatedAt,
    required this.conversationIds,
  });

  factory AdvisorInboxSummary.fromJson(Map<String, dynamic> json) {
    return AdvisorInboxSummary(
      id: json['id']?.toString() ?? '',
      countryCode: json['countryCode']?.toString() ?? 'PE',
      customerName: json['customerName']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      phonePretty: json['phonePretty']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      district: json['district']?.toString() ?? '',
      province: json['province']?.toString() ?? '',
      currentStep: json['currentStep']?.toString() ?? '',
      handoffReason: json['handoffReason']?.toString() ?? '',
      whatsappState: json['whatsappState']?.toString() ?? '',
      status: json['status']?.toString() ?? 'open',
      assignedTo: json['assignedTo']?.toString(),
      assignedToLabel: json['assignedToLabel']?.toString(),
      assignedAt: json['assignedAt']?.toString(),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      tags: (json['tags'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
      internalNote: json['internalNote']?.toString() ?? '',
      nextAction: json['nextAction']?.toString() ?? '',
      manualPriority: json['manualPriority']?.toString() ?? '',
      relatedVisitId: json['relatedVisitId']?.toString() ?? '',
      relatedQuoteId: json['relatedQuoteId']?.toString() ?? '',
      lastMessageText: json['lastMessageText']?.toString() ?? '',
      lastMessageAt: json['lastMessageAt']?.toString() ?? '',
      lastIncomingAt: json['lastIncomingAt']?.toString(),
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
      conversationIds: (json['conversationIds'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
    );
  }
}

class AdvisorInboxConversation {
  final String id;
  final String requestedId;
  final List<String> conversationIds;
  final String countryCode;
  final String phone;
  final String phonePretty;
  final String customerName;
  final String email;
  final String step;
  final String handoffReason;
  final String whatsappState;
  final String status;
  final String? assignedTo;
  final String? assignedToLabel;
  final String? assignedAt;
  final String district;
  final String province;
  final String installationAddress;
  final String receiptAddress;
  final String ticketContext;
  final List<String> tags;
  final String internalNote;
  final String nextAction;
  final String manualPriority;
  final String relatedVisitId;
  final String relatedQuoteId;
  final int unreadCount;
  final int historyConversationCount;
  final int historyMessageCount;
  final String createdAt;
  final String updatedAt;

  const AdvisorInboxConversation({
    required this.id,
    required this.requestedId,
    required this.conversationIds,
    required this.countryCode,
    required this.phone,
    required this.phonePretty,
    required this.customerName,
    required this.email,
    required this.step,
    required this.handoffReason,
    required this.whatsappState,
    required this.status,
    required this.assignedTo,
    required this.assignedToLabel,
    required this.assignedAt,
    required this.district,
    required this.province,
    required this.installationAddress,
    required this.receiptAddress,
    required this.ticketContext,
    required this.tags,
    required this.internalNote,
    required this.nextAction,
    required this.manualPriority,
    required this.relatedVisitId,
    required this.relatedQuoteId,
    required this.unreadCount,
    required this.historyConversationCount,
    required this.historyMessageCount,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AdvisorInboxConversation.fromJson(Map<String, dynamic> json) {
    return AdvisorInboxConversation(
      id: json['id']?.toString() ?? '',
      requestedId: json['requestedId']?.toString() ?? '',
      conversationIds: (json['conversationIds'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
      countryCode: json['countryCode']?.toString() ?? 'PE',
      phone: json['phone']?.toString() ?? '',
      phonePretty: json['phonePretty']?.toString() ?? '',
      customerName: json['customerName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      step: json['step']?.toString() ?? '',
      handoffReason: json['handoffReason']?.toString() ?? '',
      whatsappState: json['whatsappState']?.toString() ?? '',
      status: json['status']?.toString() ?? 'open',
      assignedTo: json['assignedTo']?.toString(),
      assignedToLabel: json['assignedToLabel']?.toString(),
      assignedAt: json['assignedAt']?.toString(),
      district: json['district']?.toString() ?? '',
      province: json['province']?.toString() ?? '',
      installationAddress: json['installationAddress']?.toString() ?? '',
      receiptAddress: json['receiptAddress']?.toString() ?? '',
      ticketContext: json['ticketContext']?.toString() ?? '',
      tags: (json['tags'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
      internalNote: json['internalNote']?.toString() ?? '',
      nextAction: json['nextAction']?.toString() ?? '',
      manualPriority: json['manualPriority']?.toString() ?? '',
      relatedVisitId: json['relatedVisitId']?.toString() ?? '',
      relatedQuoteId: json['relatedQuoteId']?.toString() ?? '',
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      historyConversationCount:
          (json['historyConversationCount'] as num?)?.toInt() ?? 0,
      historyMessageCount: (json['historyMessageCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }
}

class AdvisorInboxMessage {
  final String id;
  final String conversationId;
  final String role;
  final String text;
  final String type;
  final String createdAt;
  final String? source;
  final String? advisorName;
  final String? advisorEmail;
  final String? systemAction;
  final String? forwardedTo;
  final String? forwardedToLabel;
  final String? mediaUrl;
  final String? mimeType;
  final String? fileName;
  final int? fileSize;
  final List<dynamic>? sharedContacts;
  final String? contactName;
  final String? contactPhone;
  final String? locationName;
  final String? locationAddress;
  final double? latitude;
  final double? longitude;
  final String? interactiveTitle;

  const AdvisorInboxMessage({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.text,
    required this.type,
    required this.createdAt,
    required this.source,
    required this.advisorName,
    required this.advisorEmail,
    required this.systemAction,
    required this.forwardedTo,
    required this.forwardedToLabel,
    required this.mediaUrl,
    required this.mimeType,
    required this.fileName,
    required this.fileSize,
    required this.sharedContacts,
    required this.contactName,
    required this.contactPhone,
    required this.locationName,
    required this.locationAddress,
    required this.latitude,
    required this.longitude,
    required this.interactiveTitle,
  });

  bool get isSystem => systemAction != null || role == 'system';
  bool get isAdvisor {
    if (source == 'advisor_forward_jeny') return true;
    if (source == 'advisor_forward_jeny_intro') return true;
    return role == 'advisor' || role == 'assistant';
  }

  bool get hasMedia => mediaUrl != null && mediaUrl!.trim().isNotEmpty;
  bool get isImage =>
      (mimeType ?? '').startsWith('image/') || type.toLowerCase() == 'image';

  factory AdvisorInboxMessage.fromJson(Map<String, dynamic> json) {
    return AdvisorInboxMessage(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString() ?? '',
      role: json['role']?.toString() ?? 'user',
      text: json['text']?.toString() ?? '',
      type: json['type']?.toString() ?? 'text',
      createdAt: json['createdAt']?.toString() ?? '',
      source: json['source']?.toString(),
      advisorName: json['advisorName']?.toString(),
      advisorEmail: json['advisorEmail']?.toString(),
      systemAction: json['systemAction']?.toString(),
      forwardedTo: json['forwardedTo']?.toString(),
      forwardedToLabel: json['forwardedToLabel']?.toString(),
      mediaUrl: json['mediaUrl']?.toString(),
      mimeType: json['mimeType']?.toString(),
      fileName: json['fileName']?.toString(),
      fileSize: (json['fileSize'] as num?)?.toInt(),
      sharedContacts: json['sharedContacts'] as List<dynamic>?,
      contactName: json['contactName']?.toString(),
      contactPhone: json['contactPhone']?.toString(),
      locationName: json['locationName']?.toString(),
      locationAddress: json['locationAddress']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      interactiveTitle: json['interactiveTitle']?.toString(),
    );
  }
}

class AdvisorInboxFileRecord {
  final String id;
  final String fileName;
  final String fileType;
  final String mimeType;
  final int fileSize;
  final String clientName;
  final String phone;
  final String ticketId;
  final String createdAt;
  final String? url;

  const AdvisorInboxFileRecord({
    required this.id,
    required this.fileName,
    required this.fileType,
    required this.mimeType,
    required this.fileSize,
    required this.clientName,
    required this.phone,
    required this.ticketId,
    required this.createdAt,
    required this.url,
  });

  factory AdvisorInboxFileRecord.fromJson(Map<String, dynamic> json) {
    return AdvisorInboxFileRecord(
      id: json['id']?.toString() ?? '',
      fileName: json['fileName']?.toString() ?? '',
      fileType: json['fileType']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? '',
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      clientName: json['clientName']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      ticketId: json['ticketId']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      url: json['url']?.toString(),
    );
  }
}

class AdvisorInboxArtifactRecord {
  final String id;
  final String artifactType;
  final String title;
  final String summary;
  final String phone;
  final String ticketId;
  final String createdAt;
  final Map<String, dynamic>? payload;

  const AdvisorInboxArtifactRecord({
    required this.id,
    required this.artifactType,
    required this.title,
    required this.summary,
    required this.phone,
    required this.ticketId,
    required this.createdAt,
    required this.payload,
  });

  factory AdvisorInboxArtifactRecord.fromJson(Map<String, dynamic> json) {
    final rawPayload = json['payload'];
    return AdvisorInboxArtifactRecord(
      id: json['id']?.toString() ?? '',
      artifactType: json['artifactType']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      summary: json['summary']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      ticketId: json['ticketId']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      payload: rawPayload is Map<String, dynamic>
          ? rawPayload
          : rawPayload is Map
              ? Map<String, dynamic>.from(rawPayload)
              : null,
    );
  }
}

class AdvisorInboxDetail {
  final AdvisorInboxConversation conversation;
  final AdvisorInboxProfile profile;
  final List<AdvisorInboxMessage> messages;
  final List<AdvisorInboxFileRecord> files;
  final List<AdvisorInboxArtifactRecord> artifacts;

  const AdvisorInboxDetail({
    required this.conversation,
    required this.profile,
    required this.messages,
    required this.files,
    required this.artifacts,
  });

  factory AdvisorInboxDetail.fromJson(Map<String, dynamic> json) {
    return AdvisorInboxDetail(
      conversation: AdvisorInboxConversation.fromJson(
        Map<String, dynamic>.from(json['conversation'] as Map? ?? const {}),
      ),
      profile: AdvisorInboxProfile.fromJson(
        Map<String, dynamic>.from(json['profile'] as Map? ?? const {}),
      ),
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .map((item) => AdvisorInboxMessage.fromJson(
              Map<String, dynamic>.from(item as Map)))
          .toList(),
      files: (json['files'] as List<dynamic>? ?? const [])
          .map((item) => AdvisorInboxFileRecord.fromJson(
              Map<String, dynamic>.from(item as Map)))
          .toList(),
      artifacts: (json['artifacts'] as List<dynamic>? ?? const [])
          .map((item) => AdvisorInboxArtifactRecord.fromJson(
              Map<String, dynamic>.from(item as Map)))
          .toList(),
    );
  }
}

class AdvisorInboxProfile {
  final String receiptAddress;
  final String receiptDistrict;
  final String receiptProvince;
  final String receiptPower;
  final String installationAddress;
  final String receiverName;
  final String receiverDocument;
  final String receiverPhone;
  final String receiverEmail;
  final String vehicleBrand;
  final String vehicleModel;
  final String vehicleType;

  const AdvisorInboxProfile({
    required this.receiptAddress,
    required this.receiptDistrict,
    required this.receiptProvince,
    required this.receiptPower,
    required this.installationAddress,
    required this.receiverName,
    required this.receiverDocument,
    required this.receiverPhone,
    required this.receiverEmail,
    required this.vehicleBrand,
    required this.vehicleModel,
    required this.vehicleType,
  });

  factory AdvisorInboxProfile.fromJson(Map<String, dynamic> json) {
    return AdvisorInboxProfile(
      receiptAddress: json['receiptAddress']?.toString() ?? '',
      receiptDistrict: json['receiptDistrict']?.toString() ?? '',
      receiptProvince: json['receiptProvince']?.toString() ?? '',
      receiptPower: json['receiptPower']?.toString() ?? '',
      installationAddress: json['installationAddress']?.toString() ?? '',
      receiverName: json['receiverName']?.toString() ?? '',
      receiverDocument: json['receiverDocument']?.toString() ?? '',
      receiverPhone: json['receiverPhone']?.toString() ?? '',
      receiverEmail: json['receiverEmail']?.toString() ?? '',
      vehicleBrand: json['vehicleBrand']?.toString() ?? '',
      vehicleModel: json['vehicleModel']?.toString() ?? '',
      vehicleType: json['vehicleType']?.toString() ?? '',
    );
  }
}

class AdvisorVisitOptionDay {
  final String date;
  final String label;

  const AdvisorVisitOptionDay({
    required this.date,
    required this.label,
  });

  factory AdvisorVisitOptionDay.fromJson(Map<String, dynamic> json) {
    return AdvisorVisitOptionDay(
      date: json['date']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
    );
  }
}

class AdvisorVisitOptionSlot {
  final String label;
  final String time;
  final String endTime;

  const AdvisorVisitOptionSlot({
    required this.label,
    required this.time,
    required this.endTime,
  });

  factory AdvisorVisitOptionSlot.fromJson(Map<String, dynamic> json) {
    return AdvisorVisitOptionSlot(
      label: json['label']?.toString() ?? '',
      time: json['time']?.toString() ?? '',
      endTime: json['endTime']?.toString() ?? '',
    );
  }
}

class AdvisorVisitOptions {
  final String zone;
  final List<AdvisorVisitOptionDay> days;
  final List<AdvisorVisitOptionSlot> slots;

  const AdvisorVisitOptions({
    required this.zone,
    required this.days,
    required this.slots,
  });

  factory AdvisorVisitOptions.fromJson(Map<String, dynamic> json) {
    return AdvisorVisitOptions(
      zone: json['zone']?.toString() ?? '',
      days: (json['days'] as List<dynamic>? ?? const [])
          .map((item) => AdvisorVisitOptionDay.fromJson(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
      slots: (json['slots'] as List<dynamic>? ?? const [])
          .map((item) => AdvisorVisitOptionSlot.fromJson(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
    );
  }
}
