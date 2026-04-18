"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";

// --- 1. الإعدادات ---
export type Lang = "fr" | "ar" | "en";

export const LANGS: { value: Lang; label: string; dir: "ltr" | "rtl" }[] = [
  { value: "fr", label: "FR", dir: "ltr" },
  { value: "ar", label: "AR", dir: "rtl" },
  { value: "en", label: "EN", dir: "ltr" },
];

export const defaultLang: Lang = "fr";

// --- 2. القاموس (Dictionaries) ---
const dictionaries = {
  en: {
    brand: "GS365Cash",
    overview: "Overview",
    newOrder: "New Order",
    orders: "Orders",
    chat: "Chat",
    winnings: "Winnings",
    addPlayer: "Add Player",
    recharge: "Recharge",
    settings: "Settings",
    agents: "Agents",
    branding: "Branding",
    logout: "Logout",
    notifications: "Notifications",
    myProfile: "My Profile",
    heroTitle: "Recharge with confidence...",
    heroBody: "A premium workspace...",
    login: "Login",
    createPlayer: "Create Player Account",
    becomeAgent: "Become an Agent",
    chooseAgent: "Choose Agent",
    openWorkspace: "Login",
    playerRegistration: "Player registration",
    optionalAgentCode: "Agent code (optional)",
    continueNext: "Next",
    selectAgent: "Select your agent",
    filters: "Filters",
    paymentMethods: "Payment methods",
    countryRegion: "Country / Region",
    amount: "Amount",
    paymentTime: "Payment time",
    all: "All",
    online: "Online",
    offline: "Offline",
    trades: "Trades",
    rating: "Rating",
    buy: "Buy",
    reset: "Reset",
    confirm: "Confirm",
    achat: "Achat",
    uploadProof: "Upload proof",
    proofHint: "The proof image must clearly show today's date and the transferred amount.",
    antiFraud: "Duplicate image protection and basic fraud flags are active.",
    assignedAgent: "Assigned agent",
    myOrders: "My orders",
    complaints: "Complaints",
    support: "Support",
    statusActive: "Active",
    statusInactive: "Inactive",
    accountPending: "Your account is waiting for activation by the selected agent.",
    noAgentYet: "No agent assigned yet",
    enterAmount: "Enter amount",
    gosportUsername: "GoSport 365 username",
    notesOptional: "Optional note",
    createOrder: "Create order",
    processing: "Processing...",
    agentCodeLinked: "Agent code applied successfully.",
    chooseYourMethod: "Choose a payment method",
    back: "Back",
    availableMethods: "Available methods",
    transferInstructions: "Transfer instructions",
    accountName: "Account name",
    accountNumber: "Account number",
    walletAddress: "Wallet address",
    promoTitle: "Promoted offer",
    saveFilter: "Save filter for next use",
    verifiedOnly: "Verified merchants only",
    selectOffer: "Select offer",
    noOffers: "No matching offers found.",
    methods: "Methods",
    eta: "Time",
    limit: "Limit",
    available: "Available",
    language: "Language",
    chargeNow: "Recharge now",
    changeAgent: "Change my agent",
    agentStatus: "Agent status",
    lastSeen: "Last seen",
    awayFor: "Away for",
    selectYourMethod: "Select your method",
    createNewOrder: "Create your new order",
    confirmGosportUsername: "Confirm GoSport 365 username",
    orderSend: "Order send",
    active: "Active",
    suspended: "Suspended",
    status: "Status",
    confirmStatus: "Change agent status?",
    save: "Save",
    update: "Update",
    cancel: "Cancel",
    edit: "Edit",
    recharge_title: "Recharge Account",
recharge_subtitle: "Add balance to your wallet",
recharge_amount_label: "Amount (DH)",
recharge_method_label: "Payment Method",
recharge_proof_label: "Payment Proof",
recharge_upload_success: "Uploaded successfully",
recharge_upload_hint: "Click to upload proof",
recharge_note_label: "Note (Optional)",
recharge_submit_btn: "Confirm Recharge",
recharge_payment_details: "Payment Details",
recharge_account_name: "Account Name:",
recharge_rib: "RIB:",
recharge_wallet_addr: "Wallet Address:",
recharge_select_method_hint: "Please select a payment method to view details",
recharge_fill_all_fields: "Please fill all fields and upload proof",
recharge_request_sent: "Request sent successfully",
error_loading_failed: "Failed to load data",
error_failed_to_send: "Failed to send request",
error_network_error: "Network error occurred",
loading: "Loading...",
sending: "Sending...",
    recharge_account_name_label: "Account Name",
    recharge_rib_label: "RIB",
    recharge_wallet_addr_label: "Wallet Address",
  },
  fr: {
    brand: "GS365Cash",
    overview: "Tableau de bord",
    newOrder: "Nouvelle commande",
    orders: "Commandes",
    chat: "Chat",
    winnings: "Gains",
    addPlayer: "Ajouter joueur",
    recharge: "Recharge",
    settings: "Paramètres",
    agents: "Agents",
    branding: "Branding",
    logout: "Déconnexion",
    notifications: "Notifications",
    myProfile: "Mon profil",
    heroTitle: "Rechargez en toute confiance...",
    heroBody: "Un espace premium...",
    login: "Connexion",
    createPlayer: "Créer un compte joueur",
    becomeAgent: "Devenir agent",
    chooseAgent: "Choisir un agent",
    openWorkspace: "Connexion",
    playerRegistration: "Inscription joueur",
    optionalAgentCode: "Code agent (optionnel)",
    continueNext: "Suivant",
    selectAgent: "Choisissez votre agent",
    filters: "Filtres",
    paymentMethods: "Méthode de paiement",
    countryRegion: "Pays / Région",
    amount: "Montant",
    paymentTime: "Temps de paiement",
    all: "Tous",
    online: "En ligne",
    offline: "Hors ligne",
    trades: "Transactions",
    rating: "Note",
    buy: "Acheter",
    reset: "Réinitialiser",
    confirm: "Confirmer",
    achat: "Achat",
    uploadProof: "Téléverser la preuve",
    proofHint: "L'image de preuve doit montrer clairement la date du jour et le montant transféré.",
    antiFraud: "Protection contre les doublons d'image et signaux anti-fraude de base activés.",
    assignedAgent: "Agent assigné",
    myOrders: "Mes commandes",
    complaints: "Réclamations",
    support: "Support",
    statusActive: "Actif",
    statusInactive: "Inactif",
    accountPending: "Votre compte attend l'activation par l'agent sélectionné.",
    noAgentYet: "Aucun agent assigné",
    enterAmount: "Entrer le montant",
    gosportUsername: "Nom utilisateur GoSport 365",
    notesOptional: "Note optionnelle",
    createOrder: "Créer la commande",
    processing: "Traitement...",
    agentCodeLinked: "Code agent appliqué avec succès.",
    chooseYourMethod: "Choisissez une méthode de paiement",
    back: "Retour",
    availableMethods: "Méthodes disponibles",
    transferInstructions: "Instructions de transfert",
    accountName: "Nom du compte",
    accountNumber: "Numéro de compte",
    walletAddress: "Adresse wallet",
    promoTitle: "Offre sponsorisée",
    saveFilter: "Enregistrer ce filtre",
    verifiedOnly: "Marchands vérifiés seulement",
    selectOffer: "Sélectionner l'offre",
    noOffers: "Aucune offre correspondante.",
    methods: "Méthodes",
    eta: "Délai",
    limit: "Limite",
    available: "Disponible",
    language: "Langue",
    chargeNow: "Recharger maintenant",
    changeAgent: "Changer mon agent",
    agentStatus: "Statut de l'agent",
    lastSeen: "Vu pour la dernière fois",
    awayFor: "Absent depuis",
    selectYourMethod: "Sélectionnez votre méthode",
    createNewOrder: "Créez votre nouvelle commande",
    confirmGosportUsername: "Confirmez le nom GoSport 365",
    orderSend: "Envoyer la commande",
    active: "Actif",
    suspended: "Suspendu",
    status: "Statut",
    confirmStatus: "Voulez-vous changer le statut?",
    save: "Enregistrer",
    update: "Mettre à jour",
    cancel: "Annuler",
    edit: "Modifier",
    recharge_title: "Recharger le compte",
recharge_subtitle: "Ajoutez du solde à votre portefeuille",
recharge_amount_label: "Montant (DH)",
recharge_method_label: "Méثode de paiement",
recharge_proof_label: "Preuve de paiement",
recharge_upload_success: "Téléchargé avec succès",
recharge_upload_hint: "Cliquez pour télécharger la preuve",
recharge_note_label: "Note (Optionnel)",
recharge_submit_btn: "Confirmer la recharge",
recharge_payment_details: "Détails du paiement",
recharge_account_name: "Nom du compte:",
recharge_rib: "RIB:",
recharge_wallet_addr: "Adresse Wallet:",
recharge_select_method_hint: "Veuillez sélectionner une méthode pour voir les détails",
recharge_fill_all_fields: "Veuillez remplir tous les champs et télécharger la preuve",
recharge_request_sent: "Demande envoyée avec succès",
error_loading_failed: "Échec du chargement des données",
error_failed_to_send: "Échec de l'envoi de la demande",
error_network_error: "Une erreur réseau est survenue",
loading: "Chargement...",
sending: "Envoi en cours...",
    recharge_account_name_label: "Nom du compte",
    recharge_rib_label: "RIB",
    recharge_wallet_addr_label: "Adresse Wallet",
  },
  ar: {
    brand: "موب كاش برو",
    overview: "نظرة عامة",
    newOrder: "طلب جديد",
    orders: "الطلبات",
    chat: "الدردشة",
    winnings: "الأرباح",
    addPlayer: "إضافة لاعب",
    recharge: "شحن الرصيد",
    settings: "الإعدادات",
    agents: "الوكلاء",
    branding: "الهوية البصرية",
    logout: "تسجيل الخروج",
    notifications: "التنبيهات",
    myProfile: "ملفي الشخصي",
    heroTitle: "اشترِ بثقة، اختر الوكيل المناسب وادفع بالطريقة التي تناسبك.",
    heroBody: "منصة احترافية للاعبين والوكلاء والإدارة مع دعم ثلاثي اللغات وتجربة شراء حديثة ومحاسبة محافظ ومراجعة آمنة للطلبات.",
    login: "تسجيل الدخول",
    createPlayer: "إنشاء حساب لاعب",
    becomeAgent: "أصبح وكيلاً",
    chooseAgent: "اختر وكيلاً",
    openWorkspace: "تسجيل الدخول",
    playerRegistration: "تسجيل لاعب",
    optionalAgentCode: "رمز الوكيل (اختياري)",
    continueNext: "التالي",
    selectAgent: "اختر الوكيل المناسب",
    filters: "الفلاتر",
    paymentMethods: "طرق الدفع",
    countryRegion: "الدولة / المنطقة",
    amount: "المبلغ",
    paymentTime: "مدة الدفع",
    all: "الكل",
    online: "متصل",
    offline: "غير متصل",
    trades: "الصفقات",
    rating: "التقييم",
    buy: "شراء",
    reset: "إعادة تعيين",
    confirm: "تأكيد",
    achat: "شراء",
    uploadProof: "رفع صورة الإثبات",
    proofHint: "يجب أن تُظهر صورة الإثبات تاريخ اليوم والمبلغ المحول بشكل واضح.",
    antiFraud: "الحماية من تكرار الصورة وإشارات الاحتيال الأساسية مفعّلة.",
    assignedAgent: "الوكيل المعيّن",
    myOrders: "طلباتي",
    complaints: "الشكايات",
    support: "الدعم",
    statusActive: "نشط",
    statusInactive: "غير نشط",
    accountPending: "حسابك ينتظر التفعيل من طرف الوكيل الذي اخترته.",
    noAgentYet: "لا يوجد وكيل معيّن بعد",
    enterAmount: "أدخل المبلغ",
    gosportUsername: "اسم المستخدم في GoSport 365",
    notesOptional: "ملاحظة اختيارية",
    createOrder: "إنشاء الطلب",
    processing: "جارٍ المعالجة...",
    agentCodeLinked: "تم ربط رمز الوكيل بنجاح.",
    chooseYourMethod: "اختر طريقة الدفع",
    back: "رجوع",
    availableMethods: "الطرق المتاحة",
    transferInstructions: "تعليمات التحويل",
    accountName: "اسم الحساب",
    accountNumber: "رقم الحساب",
    walletAddress: "عنوان المحفظة",
    promoTitle: "عرض ممول",
    saveFilter: "حفظ الفلتر للاستخدام القادم",
    verifiedOnly: "وكلاء موثوقون فقط",
    selectOffer: "اختر العرض",
    noOffers: "لا توجد عروض مطابقة.",
    methods: "الطرق",
    eta: "المدة",
    limit: "الحد",
    available: "المتوفر",
    language: "اللغة",
    chargeNow: "اشحن الآن",
    changeAgent: "غيّر وكيلي",
    agentStatus: "حالة الوكيل",
    lastSeen: "آخر ظهور",
    awayFor: "غادر منذ",
    selectYourMethod: "اختر طريقتك",
    createNewOrder: "أنشئ طلبك الجديد",
    confirmGosportUsername: "أكد اسم GoSport 365",
    orderSend: "إرسال الطلب",
    active: "نشط",
    suspended: "موقف",
    status: "الحالة",
    confirmStatus: "هل تريد تغيير حالة الوكيل؟",
    save: "حفظ",
    update: "تحديث",
    cancel: "إلغاء",
    edit: "تعديل",
    loading: "جاري التحميل...",
    sending: "جاري الإرسال...",
    title: "شحن الحساب",
  subtitle: "قم بإضافة رصيد إلى محفظتك الإلكترونية",
  amount_label: "المبلغ المراد شحنه (درهم)",
  method_label: "اختر طريقة الدفع",
  proof_label: "رفع وصل التحويل (صورة)",
  upload_success: "تم رفع الوصل بنجاح",
  upload_hint: "اضغط هنا لرفع صورة الوصل",
  note_label: "ملاحظات إضافية",
  submit_btn: "تأكيد طلب الشحن",
  payment_details: "بيانات الدفع",
  account_name: "اسم الحساب:",
  rib: "رقم الحساب (RIB):",
  wallet_addr: "عنوان المحفظة:",
  select_method_hint: "يرجى اختيار طريقة دفع لعرض البيانات البنكية",
  fill_all_fields: "يرجى ملء جميع الحقول ورفع وصل الدفع",
  request_sent: "تم إرسال طلبك بنجاح",
  recharge_title: "شحن الحساب",
recharge_subtitle: "قم بإضافة رصيد إلى محفظتك الإلكترونية",
recharge_amount_label: "المبلغ المراد شحنه (درهم)",
recharge_method_label: "اختر طريقة الدفع",
recharge_proof_label: "رفع وصل التحويل (صورة)",
recharge_upload_success: "تم رفع الوصل بنجاح",
recharge_upload_hint: "اضغط هنا لرفع صورة الوصل",
recharge_note_label: "ملاحظات إضافية",
recharge_submit_btn: "تأكيد طلب الشحن",
recharge_payment_details: "بيانات الدفع",
recharge_account_name: "اسم الحساب:",
recharge_rib: "رقم الحساب (RIB):",
recharge_wallet_addr: "عنوان المحفظة:",
recharge_select_method_hint: "يرجى اختيار طريقة دفع لعرض البيانات البنكية",
recharge_fill_all_fields: "يرجى ملء جميع الحقول ورفع وصل الدفع",
recharge_request_sent: "تم إرسال طلبك بنجاح",
error_loading_failed: "فشل تحميل البيانات",
error_failed_to_send: "فشل إرسال الطلب",
error_network_error: "خطأ في الاتصال بالخادم",
    recharge_account_name_label: "اسم الحساب",
    recharge_rib_label: "رقم الحساب (RIB)",
    recharge_wallet_addr_label: "عنوان المحفظة",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries["en"];

// --- 3. المحرك المصلح (Context API) ---
interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(defaultLang);
  const [mounted, setMounted] = useState(false);

  // دالة لتحديث خصائص الـ HTML tag (مهمة جداً للـ RTL والـ Scrollbars)
  const syncHtmlAttributes = (l: Lang) => {
    const direction = LANGS.find((item) => item.value === l)?.dir || "ltr";
    document.documentElement.dir = direction;
    document.documentElement.lang = l;
  };

  useEffect(() => {
    const saved = localStorage.getItem("app_lang") as Lang;
    if (saved && ["fr", "ar", "en"].includes(saved)) {
      setLangState(saved);
      syncHtmlAttributes(saved);
    } else {
      syncHtmlAttributes(defaultLang);
    }
    setMounted(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    syncHtmlAttributes(l);
    localStorage.setItem("app_lang", l);
    document.cookie = `lang=${l}; path=/; max-age=31536000`;
  };

  const t = (key: TranslationKey) => {
    return (
      dictionaries[lang][key as keyof typeof dictionaries["en"]] ||
      dictionaries.en[key as keyof typeof dictionaries["en"]] ||
      key
    );
  };

  const dir = LANGS.find((l) => l.value === lang)?.dir || "ltr";

  // لمنع الـ Hydration Mismatch والـ Flicker
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {/* 🟢 الـ Wrapper دابا كياخد حتى الـ font-arabic */}
      <div 
        dir={dir} 
        className={`${lang === "ar" ? "font-arabic" : ""} min-h-screen`}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  
  // 🟢 المسمار: إلا كنا فـ الـ Build ومالقاش الـ Context، ما نطلعوش Error
  // غانرجعو قيم افتراضية باش يدوز الـ Build بسلام
  if (!context) {
    return {
      lang: defaultLang,
      setLang: () => {},
      t: (key: TranslationKey) => dictionaries[defaultLang][key as keyof typeof dictionaries["en"]] || key,
      dir: "ltr" as const,
    };
  }
  
  return context;
}

export function translate(lang: Lang, key: TranslationKey) {
  return dictionaries[lang]?.[key as keyof typeof dictionaries["en"]] || dictionaries.en[key] || key;
}