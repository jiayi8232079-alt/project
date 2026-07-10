import 'package:flutter/material.dart';

class VolumeSlider extends StatelessWidget {
  const VolumeSlider({
    super.key,
    required this.value,
    required this.mute,
    required this.onChanged,
    required this.onMuteToggle,
  });

  final int value;
  final bool mute;
  final ValueChanged<int> onChanged;
  final VoidCallback onMuteToggle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          icon: Icon(mute ? Icons.mic_off : Icons.mic),
          tooltip: mute ? '已关麦' : '点击关麦',
          color: mute ? Theme.of(context).colorScheme.error : null,
          onPressed: onMuteToggle,
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Slider(
            value: mute ? 0 : value.toDouble(),
            min: 0,
            max: 100,
            divisions: 20,
            label: '$value',
            onChanged: mute ? null : (v) => onChanged(v.round()),
          ),
        ),
        SizedBox(
          width: 36,
          child: Text(
            mute ? '静音' : '$value',
            textAlign: TextAlign.end,
            style: const TextStyle(fontSize: 14),
          ),
        ),
      ],
    );
  }
}
