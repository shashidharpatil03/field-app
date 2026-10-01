import { createContext, useContext } from "react";

// Every piece of text the farmer or facilitator reads lives here,
// once in English (en) and once in Marathi (mr).
export const translations = {
  en: {
    appName: "Field Tools",
    signInPrompt: "Sign in to continue",
    chooseUser: "Choose your name",
    chooseUserOption: "Choose...",
    signIn: "Sign in",
    demoNote: "Demo sign-in. No password is used and all users are made up.",
    usersFailed: "Could not load the users. Is the backend running?",
    role_pu_manager: "PU manager",
    role_facilitator: "Field facilitator",
    welcome: "Welcome, {name}",
    logOut: "Log out",
    home: "Home",
    comingSoon: "This module is not built yet.",

    menu_farmers: "Farmer Data",
    menu_practice: "Practice Adoption",
    menu_capacity: "Capacity Strengthening",
    menu_rir: "RIR",

    statContinuing: "Farmers continuing",
    statGrowing: "Growing cotton",

    tabLgs: "Learning groups",
    tabFfs: "Facilitators",
    tabMove: "Move groups",

    farmers: "farmers",
    facilitator: "Facilitator:",
    nobodyYet: "Nobody yet",
    moveToFf: "Move to another FF",
    chooseFf: "Choose a facilitator...",
    confirmMove: "Confirm move",
    cancel: "Cancel",
    history: "History",
    hideHistory: "Hide history",
    to: "to",
    now: "now",
    registerFarmer: "Register farmer",
    drafts: "Drafts ({n})",
    hideDrafts: "Hide drafts",
    unnamedFarmer: "Unnamed farmer",
    saved: "Saved",
    continue: "Continue",
    delete: "Delete",
    viewFarmers: "View farmers",
    hideFarmers: "Hide farmers",
    showDropped: "Show dropped out farmers",
    selectSeveral: "Select several farmers",
    selectAllContinuing: "Select all continuing",
    clear: "Clear",
    nSelected: "{n} selected",
    droppedOut: "Dropped out",
    growingCotton: "Growing cotton",
    notGrowingCotton: "Not growing cotton",
    gender_Female: "Female",
    gender_Male: "Male",
    gender_Other: "Other",
    movedTo: "{lg} now belongs to {name}.",
  },

  mr: {
    appName: "फील्ड टूल्स",
    signInPrompt: "पुढे जाण्यासाठी साइन इन करा",
    chooseUser: "तुमचे नाव निवडा",
    chooseUserOption: "निवडा...",
    signIn: "साइन इन करा",
    demoNote: "डेमो साइन-इन. पासवर्ड वापरला जात नाही आणि सर्व वापरकर्ते काल्पनिक आहेत.",
    usersFailed: "वापरकर्ते लोड होऊ शकले नाहीत. बॅकएंड सुरू आहे का?",
    role_pu_manager: "पीयू व्यवस्थापक",
    role_facilitator: "फील्ड फॅसिलिटेटर",
    welcome: "स्वागत आहे, {name}",
    logOut: "लॉग आउट",
    home: "मुख्यपृष्ठ",
    comingSoon: "हे मॉड्यूल अद्याप तयार नाही.",

    menu_farmers: "शेतकरी माहिती",
    menu_practice: "पद्धतींचा अवलंब",
    menu_capacity: "क्षमता बांधणी",
    menu_rir: "RIR",

    statContinuing: "सहभागी शेतकरी",
    statGrowing: "कापूस लागवड करणारे",

    tabLgs: "लर्निंग ग्रुप",
    tabFfs: "फॅसिलिटेटर",
    tabMove: "ग्रुप हलवा",

    farmers: "शेतकरी",
    facilitator: "फॅसिलिटेटर:",
    nobodyYet: "अद्याप कोणी नाही",
    moveToFf: "दुसऱ्या फॅसिलिटेटरकडे हलवा",
    chooseFf: "फॅसिलिटेटर निवडा...",
    confirmMove: "हलवण्याची खात्री करा",
    cancel: "रद्द करा",
    history: "इतिहास",
    hideHistory: "इतिहास लपवा",
    to: "ते",
    now: "आता",
    registerFarmer: "शेतकरी नोंदवा",
    drafts: "मसुदे ({n})",
    hideDrafts: "मसुदे लपवा",
    unnamedFarmer: "नाव नसलेला शेतकरी",
    saved: "जतन केले",
    continue: "पुढे चला",
    delete: "हटवा",
    viewFarmers: "शेतकरी पहा",
    hideFarmers: "शेतकरी लपवा",
    showDropped: "बाहेर पडलेले शेतकरी दाखवा",
    selectSeveral: "अनेक शेतकरी निवडा",
    selectAllContinuing: "सर्व सहभागी निवडा",
    clear: "निवड काढा",
    nSelected: "{n} निवडले",
    droppedOut: "बाहेर पडले",
    growingCotton: "कापूस लागवड",
    notGrowingCotton: "कापूस लागवड नाही",
    gender_Female: "महिला",
    gender_Male: "पुरुष",
    gender_Other: "इतर",
    movedTo: "{lg} आता {name} यांच्याकडे आहे.",
  },
};

export const LanguageContext = createContext({ lang: "en", setLang: () => {} });

export function useLanguage() {
  return useContext(LanguageContext);
}

// t("welcome", { name: "Ravi" }) gives the text in the chosen language.
export function useT() {
  const { lang } = useContext(LanguageContext);
  return function t(key, values = {}) {
    let text = translations[lang][key] ?? translations.en[key] ?? key;
    for (const name of Object.keys(values)) {
      text = text.replace(`{${name}}`, values[name]);
    }
    return text;
  };
}
