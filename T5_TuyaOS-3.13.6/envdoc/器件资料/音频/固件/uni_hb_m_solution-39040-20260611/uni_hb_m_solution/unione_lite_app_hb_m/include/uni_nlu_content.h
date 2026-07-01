#ifndef INC_UNI_NLU_CONTENT_H_
#define INC_UNI_NLU_CONTENT_H_

typedef struct {
  uni_u32 key_word_hash_code; /* 存放识别词汇对应的hashcode */
  uni_u8  nlu_content_str_index; /* 存放nlu映射表中的索引，实现多个识别词汇可对应同一个nlu，暂支持256条，如果不够换u16 */
  char    *hash_collision_orginal_str /* 类似Java String equal，当hash发生碰撞时，赋值为识别词汇，否则设置为NULL */;
} uni_nlu_content_mapping_t;

enum {
  eCMD_wakeup_uni,
  eCMD_TurnOn,
};

const char* const g_nlu_content_str[] = {
[eCMD_wakeup_uni] = "{\"asr\":\"你好小佳\",\"cmd\":\"wakeup_uni\",\"pcm\":\"[103]\"}",
[eCMD_TurnOn] = "{\"asr\":\"打开台灯\",\"cmd\":\"TurnOn\",\"pcm\":\"[106]\"}",
};

/*TODO perf sort by hashcode O(logN), now version O(N)*/
const uni_nlu_content_mapping_t g_nlu_content_mapping[] = {
  {2835565196U/*你好小佳*/, eCMD_wakeup_uni, NULL},
  {4279952012U/*小佳你好*/, eCMD_wakeup_uni, NULL},
  {4266427123U/*小佳同学*/, eCMD_wakeup_uni, NULL},
  {3402919336U/*打开台灯*/, eCMD_TurnOn, NULL},
};

#endif
