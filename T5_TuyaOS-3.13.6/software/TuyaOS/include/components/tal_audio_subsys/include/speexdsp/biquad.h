
#ifndef BIQUAD_H
#define BIQUAD_H

#ifdef __cplusplus
extern "C" {
#endif

struct EQobj_;
typedef struct EQobj_ EQobj;

EQobj *EQ_create();

void EQ_process(EQobj *obj, short *x, int len);

void EQ_destroy(EQobj *obj);

struct EQobj_q12_;
typedef struct EQobj_q12_ EQobj_q12;

EQobj_q12 *EQ_create_q12();

void EQ_process_q12(EQobj_q12 *obj, short *x, short *y, int len);

void EQ_destroy_q12(EQobj_q12 *obj);

#ifdef __cplusplus
}
#endif

#endif