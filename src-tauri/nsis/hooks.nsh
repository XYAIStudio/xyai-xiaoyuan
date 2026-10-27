; Force-stop the desktop pet before copy/delete.
; The pet has no taskbar button and hides instead of exiting on WM_CLOSE,
; so NSIS Restart Manager often leaves xyai-xiaoyuan.exe locking the install dir.
; A non-zero taskkill exit (process not running) must not abort the installer.

!macro NSIS_HOOK_PREINSTALL
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM xyai-xiaoyuan.exe' $0
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM "XYAI Xiaoyuan.exe"' $0
  Sleep 400
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM xyai-xiaoyuan.exe' $0
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM "XYAI Xiaoyuan.exe"' $0
  Sleep 400
!macroend
