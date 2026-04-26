"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import adminAr from "@/messages/ar.json";
import adminEn from "@/messages/en.json";
import adminFr from "@/messages/fr.json";
import { BRANDING } from "@/lib/branding";

// --- 1. الإعدادات ---
export type Lang = "fr" | "ar" | "en";

/** BCP 47 locale for dates and numbers in admin/agent dashboards. */
export function localeForLang(lang: Lang): string {
  if (lang === "ar") return "ar-MA";
  if (lang === "fr") return "fr-FR";
  return "en-US";
}

export const LANGS: { value: Lang; label: string; dir: "ltr" | "rtl" }[] = [
  { value: "fr", label: "FR", dir: "ltr" },
  { value: "ar", label: "AR", dir: "rtl" },
  { value: "en", label: "EN", dir: "ltr" },
];

export const defaultLang: Lang = "fr";

// --- 2. القاموس (Dictionaries) ---
const dictionaries = {
  en: {
    brand: BRANDING.name,
    overview: "Overview",
    globalBroadcast: "Global broadcast",
    globalAnnouncement: "Global announcement",
    newOrder: "New Order",
    orders: "Orders",
    chat: "Chat",
    winnings: "Winnings",
    addPlayer: "Invite player / Rewards",
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
    pendingApprovalTitle: "Pending approval",
    pendingApprovalSubtitle:
      "We are reviewing your details. You should receive a response within 48 hours at most.",
    pendingWindowHint:
      "Timer shows the remaining time in your current 48-hour review window (saved for this account on this device).",
    pendingHours: "Hours",
    pendingMinutes: "Minutes",
    pendingSeconds: "Seconds",
    pendingBackHome: "Back to home",
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
recharge_method_placeholder: "— Select a method —",
recharge_amount_hint:
      "Minimum 1,000 DH. Upload proof only after you have transferred to the selected account.",
recharge_bonus_10_label: "Extra balance (10%):",
recharge_amount_total_label: "Total:",
recharge_summary_title: "Credit summary",
recharge_summary_requested: "Requested amount",
recharge_summary_standard_bonus: "Standard bonus",
recharge_summary_affiliate_bonus: "Affiliate bonus (available)",
recharge_summary_affiliate_none: "None pending",
recharge_summary_total_receive: "Total to receive",
recharge_apply_invitations_bonus:
      "Use available promotion rewards on this top-up (counts toward invitation milestones).",
recharge_submit_disabled_hint:
      "Enter at least 1,000 DH, choose a method, enter matching GoSport365 usernames, and upload an https proof link to submit.",
recharge_gosport365_username_label: "GoSport365 username",
recharge_confirm_gosport365_username_label: "Confirm GoSport365 username",
recharge_gosport365_username_hint: "Must match your GoSport365 account exactly (case-sensitive).",
recharge_validation_gosport365_username: "Enter your GoSport365 username.",
recharge_validation_gosport365_mismatch: "The two GoSport365 usernames must match exactly.",
recharge_proof_label: "Payment Proof",
recharge_upload_success: "Uploaded successfully",
recharge_select_receipt_image: "Select Receipt Image",
rechargeHistory: "Recharge history",
recharge_history_title: "Recharge history",
recharge_history_subtitle: "Your wallet top-up requests and their status.",
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
recharge_validation_amount: "Enter a valid positive amount.",
recharge_validation_amount_minimum: "The minimum recharge amount is 1,000 DH.",
recharge_validation_method: "Select a payment method.",
recharge_validation_proof: "Upload proof — the link must start with http:// or https://.",
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
    brand: BRANDING.name,
    overview: "Tableau de bord",
    globalBroadcast: "Annonce globale",
    globalAnnouncement: "Annonce globale",
    newOrder: "Nouvelle commande",
    orders: "Commandes",
    chat: "Chat",
    winnings: "Gains",
    addPlayer: "Inviter un joueur / Récompenses",
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
    pendingApprovalTitle: "Approbation en attente",
    pendingApprovalSubtitle:
      "Nous examinons vos informations. Vous devriez recevoir une réponse dans un délai maximum de 48 heures.",
    pendingWindowHint:
      "Le compte à rebours indique le temps restant dans la fenêtre d'examen de 48 h (enregistré pour ce compte sur cet appareil).",
    pendingHours: "Heures",
    pendingMinutes: "Minutes",
    pendingSeconds: "Secondes",
    pendingBackHome: "Retour à l'accueil",
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
recharge_method_placeholder: "— Choisir une méthode —",
recharge_amount_hint:
      "Minimum 1 000 DH. Téléversez la preuve après le virement vers le compte indiqué.",
recharge_bonus_10_label: "Solde supplémentaire (10 %) :",
recharge_amount_total_label: "Total :",
recharge_summary_title: "Récapitulatif du crédit",
recharge_summary_requested: "Montant demandé",
recharge_summary_standard_bonus: "Bonus standard",
recharge_summary_affiliate_bonus: "Bonus affiliation (disponible)",
recharge_summary_affiliate_none: "Aucun en attente",
recharge_summary_total_receive: "Total à recevoir",
recharge_apply_invitations_bonus:
      "Utiliser les récompenses de promotion disponibles pour cette recharge.",
recharge_submit_disabled_hint:
      "Saisissez au moins 1 000 DH, choisissez une méthode, deux noms GoSport365 identiques et une preuve https pour envoyer.",
recharge_gosport365_username_label: "Nom d'utilisateur GoSport365",
recharge_confirm_gosport365_username_label: "Confirmer le nom d'utilisateur GoSport365",
recharge_gosport365_username_hint:
      "Doit correspondre exactement à votre compte GoSport365 (sensible à la casse).",
recharge_validation_gosport365_username: "Saisissez votre nom d'utilisateur GoSport365.",
recharge_validation_gosport365_mismatch:
      "Les deux noms d'utilisateur GoSport365 doivent correspondre exactement.",
recharge_proof_label: "Preuve de paiement",
recharge_upload_success: "Téléchargé avec succès",
recharge_select_receipt_image: "Choisir l'image du reçu",
rechargeHistory: "Historique des recharges",
recharge_history_title: "Historique des recharges",
recharge_history_subtitle: "Vos demandes de recharge et leur statut.",
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
recharge_validation_amount: "Saisissez un montant positif valide.",
recharge_validation_amount_minimum: "Le montant minimum de recharge est de 1 000 DH.",
recharge_validation_method: "Sélectionnez une méthode de paiement.",
recharge_validation_proof: "Téléversez une preuve — le lien doit commencer par http:// ou https://.",
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
    brand: BRANDING.name,
    overview: "نظرة عامة",
    globalBroadcast: "بث عام",
    globalAnnouncement: "إعلان عام",
    newOrder: "طلب جديد",
    orders: "الطلبات",
    chat: "الدردشة",
    winnings: "الأرباح",
    addPlayer: "دعوة لاعب / المكافآت",
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
    pendingApprovalTitle: "طلبك قيد المراجعة",
    pendingApprovalSubtitle:
      "نعمل على مراجعة بياناتك والتأكد من مطابقتها. سيتم الرد عليك في غضون 48 ساعة كحد أقصى.",
    pendingWindowHint:
      "يعرض المؤقت الوقت المتبقي في نافذة المراجعة (48 ساعة) المحفوظة لهذا الحساب على هذا الجهاز.",
    pendingHours: "ساعات",
    pendingMinutes: "دقائق",
    pendingSeconds: "ثوانٍ",
    pendingBackHome: "العودة للرئيسية",
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
recharge_method_placeholder: "— اختر طريقة الدفع —",
recharge_amount_hint: "الحد الأدنى 1000 درهم. ارفع الوصل بعد إتمام التحويل إلى الحساب المعروض.",
recharge_bonus_10_label: "الرصيد الإضافي (10%):",
recharge_amount_total_label: "الإجمالي:",
recharge_summary_title: "ملخص الرصيد",
recharge_summary_requested: "المبلغ المطلوب",
recharge_summary_standard_bonus: "البونص القياسي",
recharge_summary_affiliate_bonus: "مكافأة الترويج (المتاحة)",
recharge_summary_affiliate_none: "لا يوجد رصيد ترويجي معلّق",
recharge_summary_total_receive: "الإجمالي المستلم",
recharge_apply_invitations_bonus: "استخدام مكافآت الترويج المتاحة في هذه الشحنة",
recharge_submit_disabled_hint:
      "أدخل 1000 درهم على الأقل، اختر طريقة الدفع، أدخل اسمي GoSport365 المتطابقين، وارفع رابط وصل https لإرسال الطلب.",
recharge_gosport365_username_label: "اسم مستخدم GoSport365",
recharge_confirm_gosport365_username_label: "تأكيد اسم مستخدم GoSport365",
recharge_gosport365_username_hint: "يجب أن يطابق حسابك في GoSport365 حرفياً (حساس لحالة الأحرف).",
recharge_validation_gosport365_username: "أدخل اسم مستخدم GoSport365.",
recharge_validation_gosport365_mismatch: "يجب أن يتطابق حقلا اسم مستخدم GoSport365 حرفياً.",
recharge_proof_label: "رفع وصل التحويل (صورة)",
recharge_upload_success: "تم رفع الوصل بنجاح",
recharge_select_receipt_image: "اختر صورة الوصل",
rechargeHistory: "سجل الشحن",
recharge_history_title: "سجل شحن المحفظة",
recharge_history_subtitle: "جميع طلبات الشحن وحالات الموافقة.",
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
recharge_validation_amount: "أدخل مبلغاً صالحاً موجباً.",
recharge_validation_amount_minimum: "أقل مبلغ للشحن هو 1000 درهم",
recharge_validation_method: "اختر طريقة الدفع.",
recharge_validation_proof: "ارفع وصل الدفع — الرابط يجب أن يبدأ بـ http:// أو https://.",
error_loading_failed: "فشل تحميل البيانات",
error_failed_to_send: "فشل إرسال الطلب",
error_network_error: "خطأ في الاتصال بالخادم",
    recharge_account_name_label: "اسم الحساب",
    recharge_rib_label: "رقم الحساب (RIB)",
    recharge_wallet_addr_label: "عنوان المحفظة",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries["en"];

const adminMessages: Record<Lang, unknown> = {
  en: adminEn,
  fr: adminFr,
  ar: adminAr,
};

function resolveAdminPath(bundle: unknown, path: string): string | undefined {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = bundle;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    const rec = cur as Record<string, unknown>;
    if (!(p in rec)) return undefined;
    cur = rec[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

// --- 3. المحرك المصلح (Context API) ---
interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  /** Dot-path messages from `/messages/{lang}.json` (e.g. `dashboard.totalSales`). */
  tx: (path: string, vars?: Record<string, string>) => string;
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

  useLayoutEffect(() => {
    const saved = localStorage.getItem("app_lang") as Lang | null;
    const initial: Lang =
      saved && ["fr", "ar", "en"].includes(saved) ? (saved as Lang) : defaultLang;
    setLangState(initial);
    syncHtmlAttributes(initial);
    setMounted(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    syncHtmlAttributes(l);
    localStorage.setItem("app_lang", l);
    document.cookie = `lang=${l}; path=/; max-age=31536000`;
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return (
      dictionaries[lang][key as keyof typeof dictionaries["en"]] ||
      dictionaries.en[key as keyof typeof dictionaries["en"]] ||
      key
    );
  }, [lang]);

  const tx = useCallback((path: string, vars?: Record<string, string>) => {
    let raw =
      resolveAdminPath(adminMessages[lang], path) ??
      resolveAdminPath(adminMessages.en, path) ??
      path;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        raw = raw.split(`{{${k}}}`).join(v);
      }
    }
    return raw;
  }, [lang]);

  const dir = LANGS.find((l) => l.value === lang)?.dir || "ltr";

  const contextValue = useMemo(
    () => ({ lang, setLang, t, tx, dir }),
    [lang, setLang, t, tx, dir],
  );

  // لمنع الـ Hydration Mismatch والـ Flicker
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {/* 🟢 الـ Wrapper دابا كياخد حتى الـ font-arabic */}
      <div 
        dir={dir} 
        className={`${lang === "ar" ? "font-arabic antialiased" : ""} min-h-screen`}
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
      tx: (path: string, vars?: Record<string, string>) => {
        let raw = resolveAdminPath(adminMessages[defaultLang], path) ?? resolveAdminPath(adminMessages.en, path) ?? path;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            raw = raw.split(`{{${k}}}`).join(v);
          }
        }
        return raw;
      },
      dir: "ltr" as const,
    };
  }
  
  return context;
}

export function translate(lang: Lang, key: TranslationKey) {
  return dictionaries[lang]?.[key as keyof typeof dictionaries["en"]] || dictionaries.en[key] || key;
}