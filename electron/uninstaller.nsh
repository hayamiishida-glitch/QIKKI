!macro customUnInstall
  ; Remove all local user data (IndexedDB, LocalStorage, sync store, desktop preferences, cached auth session)
  ; when uninstalling Qikki. Cloud reminders & preferences remain safely stored in Firebase Firestore.
  ${ifNot} ${isUpdated}
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}

    RMDir /r "$APPDATA\Qikki"
    RMDir /r "$APPDATA\qikki-reminders"
    RMDir /r "$LOCALAPPDATA\Qikki"
    RMDir /r "$LOCALAPPDATA\qikki-reminders"
    RMDir /r "$LOCALAPPDATA\qikki-reminders-updater"

    ; Clean up Windows startup login entry if Launch at Startup was enabled
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Qikki"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.qikki.reminders"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Qikki"

    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endif}
!macroend
