export const fr = {
  app: {
    eyebrow: "WebHID",
    title: "Configuration DS5 Bridge",
  },
  language: {
    label: "Langue",
    english: "Anglais",
    chinese: "中文",
    french: "Français",
  },
  theme: {
    label: "Thème",
    light: "Clair",
    dark: "Sombre",
    system: "Système",
  },
  status: {
    webHidUnavailable: "WebHID indisponible",
    connecting: "Connexion",
    reading: "Lecture de la configuration",
    readingFirmware: "Lecture de la version du firmware",
    applying: "Application de la configuration",
    saving: "Sauvegarde dans la mémoire flash",
    reconnecting: "Reconnexion USB",
    ready: "Prêt à se connecter",
    unsaved: "Modifications non sauvegardées",
    applied: "Appliqué à l’appareil",
    saved: "Sauvegardé dans la mémoire flash",
    connected: "Connecté",
  },
  notice: {
    webHidUnsupported:
      "WebHID est disponible sur les navigateurs basés sur Chromium via des origines sécurisées.",
  },
  pwa: {
    offlineReady:
      "Cette page est mise en cache et prête pour une utilisation hors ligne.",
    cacheRefresh:
      "Une nouvelle version est disponible. Mise à jour du cache de la page.",
  },
  footer: {
    title: "Pico2W DualSense 5 Bridge",
    description:
      "Pilote de configuration web permettant de transformer un Raspberry Pi Pico2W en adaptateur sans fil pour la manette DualSense (DS5).",
  },
  device: {
    label: "Appareil",
    firmwareVersion: "Firmware",
    firmwareUnknown: "Inconnu",
    signalStrength: "RSSI",
    signalStrengthUnknown: "Inconnu",
    signalStrengthTitle:
      "Plage RSSI [-128, 0], où 0 représente le meilleur signal. Actualisation toutes les 5 secondes.",
    open: "Ouvrir",
    openTitle: "Ouvrir le premier appareil précédemment autorisé",
    connect: "Connecter",
    connectTitle: "Choisir un périphérique HID DS5 Bridge",
  },
  config: {
    title: "Configuration",
    sections: {
      feedback: "Sortie de retour",
      feedbackDescription:
        "Ajustez les vibrations de la manette, le volume du haut-parleur, le volume du casque, le gain du haut-parleur et la taille du buffer.",
      power: "Alimentation et indicateurs",
      powerDescription:
        "Contrôlez la déconnexion en cas d’inactivité, la LED du Pico et le microphone et le haut-parleur de la manette.",
      performance: "Performances",
      performanceDescription:
        "Choisissez la fréquence d’interrogation des rapports HID.",
      compatibility: "Compatibilité",
      compatibilityDescription:
        "Changez le mode d’identification de la manette.",
    },
    hapticsGain: "Gain des vibrations",
    speakerVolume: "Volume du haut-parleur",
    headsetVolume: "Volume du casque",
    syncSpeakerHeadsetVolume:
      "Synchroniser le volume du haut-parleur et du casque",
    lockVolume: "Verrouiller le volume",
    speakerGain: "Gain du haut-parleur",
    inactiveTime: "Temps d’inactivité",
    inactiveTimeUnit: "Unité : minutes",
    disableInactiveDisconnect:
      "Désactiver la déconnexion en cas d’inactivité",
    disablePicoLed: "Désactiver la LED du Pico",
    disableMic: "Désactiver le microphone",
    disableSpeaker: "Désactiver le haut-parleur / casque",
    pollingRateMode: "Mode de fréquence d’interrogation",
    audioBufferLength: "Taille du buffer audio",
    controllerMode: "Mode de la manette",
    disableUsbSn: "Désactiver le numéro de série USB",
    psShortcutEnabled: "Bouton PS = Guide Xbox (uniquement disponible dans le firmware USBWake)",
    controllerModeOptions: {
      ds5: "DS5",
      dse: "DSE",
      auto: "Auto",
    },
    pollingRate: {
      hz250: "250 Hz",
      hz500: "500 Hz",
      realTime: "Temps réel",
    },
  },
  actions: {
    title: "Actions",
    read: "Lire",
    readTitle: "Lire la configuration actuelle depuis le rapport 0xF7",
    apply: "Appliquer à l’appareil",
    applyTitle: "Envoyer la commande 0x01 via le rapport 0xF6",
    save: "Sauvegarder dans la mémoire flash",
    saveTitle: "Envoyer la commande 0x02 via le rapport 0xF6",
    saveDirtyTitle:
      "Attendez que les modifications soient appliquées avant de sauvegarder",
    reconnect: "Reconnecter l’USB",
    reconnectTitle: "Envoyer la commande 0x03 via le rapport 0xF6",
    reconnectRequired:
      "La fréquence d’interrogation ou le mode de la manette a changé. Cliquez sur Reconnecter l’USB pour appliquer les changements.",
    reset: "Réinitialiser par défaut",
    resetTitle:
      "Restaurer la configuration par défaut, l’appliquer et la sauvegarder dans la mémoire flash",
    state: "État",
  },
  toggle: {
    enabled: "Activé",
    disabled: "Désactivé",
  },
  validation: {
    hapticsGain:
      "Le gain des vibrations doit être compris entre 1.0 et 2.0",
    speakerVolume:
      "Le volume du haut-parleur doit être compris entre 0 et 127",
    headsetVolume:
      "Le volume du casque doit être compris entre 0 et 127",
    speakerGain:
      "Le gain du haut-parleur doit être compris entre 0 et 7",
    inactiveTime:
      "Le temps d’inactivité doit être compris entre 5 et 60 minutes",
    pollingRateMode:
      "Le mode de fréquence d’interrogation doit être 0, 1 ou 2",
    audioBufferLength:
      "La taille du buffer audio doit être comprise entre 16 et 128",
    controllerMode:
      "Le mode de la manette doit être DS5, DSE ou Auto",
  },
  errors: {
    invalidConfig:
      "L’appareil a renvoyé une configuration invalide : {{issues}}",
    invalidBytes:
      "L’appareil a renvoyé {{count}} octets, au moins {{expected}} étaient attendus",
    configVersionMismatch:
      "Version de configuration incompatible : cette page prend en charge la version {{expected}}, l’appareil a renvoyé la version {{actual}}",
    noDeviceSelected:
      "Aucun appareil DS5 Bridge n’a été sélectionné",
    unexpectedWebHid: "Erreur WebHID inattendue",
    disconnected: "Appareil déconnecté",
  },
} as const;