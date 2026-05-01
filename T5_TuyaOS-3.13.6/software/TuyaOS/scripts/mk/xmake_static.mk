# LOCAL_PATH      := $(call my-dir)
# LOCAL_MODULE    := hello
# LOCAL_SRC_FILES := src/hello.c
# LOCAL_CFLAGS    := -I$(LOCAL_PATH)/include

# source list
_LOCAL_STATIC_SRC_LIST := $(call source-add-prefix,$(LOCAL_PATH),$(LOCAL_SRC_FILES))
-include $(call source-dependcies,$(_LOCAL_STATIC_SRC_LIST))

# static compile options
_LOCAL_STATIC_OBJ_LIST := $(call source-static-objects,$(_LOCAL_STATIC_SRC_LIST))
$(_LOCAL_STATIC_OBJ_LIST): PRIVATE_CFLAGS := $(LOCAL_CFLAGS)
$(_LOCAL_STATIC_OBJ_LIST): PRIVATE_SECTION_NAME := $(LOCAL_SECTION_NAME)

_LOCAL_STATIC_INM_LIST := $(call source-static-intermediate,$(_LOCAL_STATIC_SRC_LIST))
$(_LOCAL_STATIC_INM_LIST): PRIVATE_CFLAGS := $(LOCAL_CFLAGS)
$(_LOCAL_STATIC_INM_LIST): PRIVATE_SECTION_NAME := $(LOCAL_SECTION_NAME)

# build static target
_LOCAL_STATIC_TARGET := $(XMAKE_OUTDIR)/lib/lib$(LOCAL_MODULE).a
# Use directory-based building to avoid "Argument list too long" errors when linking many objects
_LOCAL_STATIC_OBJ_DIRS := $(sort $(dir $(_LOCAL_STATIC_OBJ_LIST)))
xmake_static: $(_LOCAL_STATIC_TARGET)
# Use target-specific variable so each module keeps its own directory list.
# Without this, _LOCAL_STATIC_OBJ_DIRS is overwritten by each subsequent
# include of xmake_static.mk, causing all modules to archive objects from
# whichever module was included last.
$(_LOCAL_STATIC_TARGET): PRIVATE_STATIC_OBJ_DIRS := $(_LOCAL_STATIC_OBJ_DIRS)
$(_LOCAL_STATIC_TARGET): $(_LOCAL_STATIC_OBJ_LIST)
	@$(call build-static-library-by-dirs,$@,$(PRIVATE_STATIC_OBJ_DIRS))

xmake_inm: $(_LOCAL_STATIC_INM_LIST)

