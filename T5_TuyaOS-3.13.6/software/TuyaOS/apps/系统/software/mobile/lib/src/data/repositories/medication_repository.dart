import '../../core/network/api_client.dart';
import '../models/medication.dart';
import '../models/parsing.dart';

class MedicationRepository {
  MedicationRepository(this._api);

  final ApiClient _api;

  Future<List<MedicationReminder>> listMine() async {
    final body = await _api.getRaw('/medication-reminders/my');
    return extractList(body).map(MedicationReminder.fromJson).toList();
  }

  Future<List<MedicationExecution>> executions(String date) async {
    final body = await _api.getRaw(
      '/medication-executions',
      query: {'startDate': date, 'endDate': date},
    );
    return extractList(body).map(MedicationExecution.fromJson).toList();
  }

  Future<void> checkIn({
    required int reminderId,
    required String scheduledDate,
    required String scheduledTime,
    String status = 'taken',
  }) async {
    await _api.postObject(
      '/medication-executions/check-in',
      data: {
        'reminderId': reminderId,
        'scheduledDate': scheduledDate,
        'scheduledTime': scheduledTime,
        'status': status,
      },
    );
  }

  /// 组装"今日用药清单"：每个提醒按 reminderTimes 展开成多次，并标记是否已打卡。
  Future<List<MedicationDose>> todayDoses() async {
    final today = _todayString();
    final reminders = await listMine();
    List<MedicationExecution> execs = const [];
    try {
      execs = await executions(today);
    } catch (_) {
      // 执行日志查询失败不应阻塞清单展示，按未打卡处理。
      execs = const [];
    }

    bool isTaken(int reminderId, String time) => execs.any(
          (e) => e.reminderId == reminderId && e.scheduledTime == time && e.isTaken,
        );

    final doses = <MedicationDose>[];
    for (final r in reminders) {
      final times = r.reminderTimes.isEmpty ? <String>['—'] : r.reminderTimes;
      for (final time in times) {
        doses.add(
          MedicationDose(
            reminderId: r.id,
            medicineName: r.medicineName,
            dosage: r.dosage,
            time: time,
            taken: isTaken(r.id, time),
          ),
        );
      }
    }
    doses.sort((a, b) => a.time.compareTo(b.time));
    return doses;
  }

  static String _todayString() {
    final now = DateTime.now();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${now.year}-${two(now.month)}-${two(now.day)}';
  }

  String get today => _todayString();
}
