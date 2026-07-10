import 'parsing.dart';

/// 用药提醒（对应 /medication-reminders/my）。
class MedicationReminder {
  const MedicationReminder({
    required this.id,
    required this.medicineName,
    required this.dosage,
    required this.reminderTimes,
    this.instructions,
    this.status,
  });

  final int id;
  final String medicineName;
  final String dosage;
  final List<String> reminderTimes;
  final String? instructions;
  final String? status;

  factory MedicationReminder.fromJson(Map<String, dynamic> json) {
    return MedicationReminder(
      id: pickInt(json, ['id']),
      medicineName:
          pickString(json, ['medicineName', 'medicine_name', 'drugName'], fallback: '药品'),
      dosage: pickString(json, ['dosage', 'dose'], fallback: ''),
      reminderTimes: asStringList(pick(json, ['reminderTimes', 'reminder_times'])),
      instructions: asString(pick(json, ['instructions', 'remark'])),
      status: asString(pick(json, ['status'])),
    );
  }
}

/// 单次用药执行记录（对应 /medication-executions）。
class MedicationExecution {
  const MedicationExecution({
    required this.reminderId,
    required this.scheduledDate,
    required this.scheduledTime,
    required this.status,
  });

  final int reminderId;
  final String scheduledDate;
  final String scheduledTime;
  final String status;

  bool get isTaken => status == 'taken';

  factory MedicationExecution.fromJson(Map<String, dynamic> json) {
    return MedicationExecution(
      reminderId: pickInt(json, ['reminderId', 'reminder_id']),
      scheduledDate:
          pickString(json, ['scheduledDate', 'scheduled_date'], fallback: ''),
      scheduledTime:
          pickString(json, ['scheduledTime', 'scheduled_time'], fallback: ''),
      status: pickString(json, ['status'], fallback: ''),
    );
  }
}

/// 页面用：今日某一次具体用药（提醒 × 时间点 + 是否已打卡）。
class MedicationDose {
  const MedicationDose({
    required this.reminderId,
    required this.medicineName,
    required this.dosage,
    required this.time,
    required this.taken,
  });

  final int reminderId;
  final String medicineName;
  final String dosage;
  final String time;
  final bool taken;

  MedicationDose copyWith({bool? taken}) => MedicationDose(
        reminderId: reminderId,
        medicineName: medicineName,
        dosage: dosage,
        time: time,
        taken: taken ?? this.taken,
      );
}
