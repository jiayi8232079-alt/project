# 当前文件所在目录
LOCAL_PATH := $(call my-dir)

#---------------------------------------

# 清除 LOCAL_xxx 变量
include $(CLEAR_VARS)

# 当前模块名
LOCAL_MODULE := $(notdir $(LOCAL_PATH))

# 模块对外头文件（只能是目录）
# 加载至CFLAGS中提供给其他组件使用；打包进SDK产物中；
LOCAL_TUYA_SDK_INC := $(LOCAL_PATH)/include
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/components/bk_rtos/freertos
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/components/os_source/freertos_smp_v2p0/FreeRTOS-Kernel/include/freertos
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/components/os_source/freertos_smp_v2p0/FreeRTOS-Kernel/portable/GCC/ARM_CM33/non_secure
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/middleware/soc/bk7258_ap/hal
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/middleware/soc/bk7258_ap/soc
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/middleware/soc/common/hal/include
LOCAL_TUYA_SDK_INC += $(LOCAL_PATH)/../../t5_os/ap/middleware/soc/common/soc/include
TUYA_APP_OPENSOURCE_INC += ${LOCAL_TUYA_SDK_INC}

# 模块对外CFLAGS：其他组件编译时可感知到
LOCAL_TUYA_SDK_CFLAGS :=

###################################################################################
# 注意
# tuyaos_adapter可以在原厂环境下编译，如果选择在原厂环境下编译，则不需要修改此文件,如果不
# 在原厂环境下编译，则可以在此文件中把模块“tuyaos_adapter/src/”下的源代码加到
# LOCAL_SRC_FILES，同时把编译需要的头文件放LOCAL_TUYA_SDK_CFLAGS
###################################################################################
# include目录下存在一些tuya提供的组件源文件，请勿修改
LOCAL_SRC_FILES := $(shell find $(LOCAL_PATH)/include -name "*.c" -o -name "*.cpp" -o -name "*.cc")
# 最小补链：只补 system provider，避免把 test/driver/misc 全量拉进来破坏当前构建
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_memory.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_mutex.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_network.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_output.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_queue.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_semaphore.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_system.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_thread.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_atomic.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_task_notify.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_fs.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_ota.c
LOCAL_SRC_FILES += $(LOCAL_PATH)/src/system/tkl_sleep.c
# 如果适配层要和tuyaos一起编译，请在此处新增原厂头文件路径
#LOCAL_TUYA_SDK_INC +=
###################################################################################

# 全局变量赋值
TUYA_SDK_INC += $(LOCAL_TUYA_SDK_INC)  # 此行勿修改
TUYA_SDK_CFLAGS += $(LOCAL_TUYA_SDK_CFLAGS)  # 此行勿修改

# 生成静态库
include $(BUILD_STATIC_LIBRARY)

# 生成动态库
include $(BUILD_SHARED_LIBRARY)

# 导出编译详情
include $(OUT_COMPILE_INFO)

#---------------------------------------

