import { locales, localeNames, isRtl, type Locale } from "@/i18n/config";

export { locales, localeNames, isRtl, type Locale };

export const STAFF_LOCALE_KEY = "qiktik-staff-locale";

export type WaiterMessages = {
  title: string;
  floor: string;
  language: string;
  sections: Record<"INSIDE" | "OUTSIDE" | "TERRACE" | "ALL", string>;
  legendTitle: string;
  legendFree: string;
  legendActive: string;
  legendReady: string;
  legendCall: string;
  legendBill: string;
  table: string;
  billTag: string;
  tabUnpaid: string;
  paid: string;
  printBill: string;
  addOrder: string;
  payCash: string;
  payCard: string;
  closeTable: string;
  confirmCloseTitle: string;
  confirmCloseBody: string;
  confirmCloseUnpaid: string;
  confirmCloseYes: string;
  confirmCloseNo: string;
  partySize: string;
  partySizeHint: string;
  partySizeAlert: string;
  partySizeRequired: string;
  partySizeSave: string;
  partySizeSaved: string;
  pickupName: string;
  pickupNameHint: string;
  pickupNamePlaceholder: string;
  pickupNameSave: string;
  pickupNameSaved: string;
  legendParty: string;
  takeaway: string;
  noSession: string;
  startSession: string;
  orderLabel: string;
  served: string;
  back: string;
  cashPayment: string;
  due: string;
  amountReceived: string;
  tip: string;
  guestTip: string;
  guestTipHint: string;
  askTipHint: string;
  totalWithTip: string;
  tipPercent: string;
  tipFixed: string;
  tipPercentPlaceholder: string;
  tipAmountPlaceholder: string;
  tipNone: string;
  change: string;
  confirmCash: string;
  cardPayment: string;
  cardHint: string;
  cardRef: string;
  confirmCard: string;
  kitchenNote: string;
  sendKitchen: string;
  menuSearch: string;
  menuAll: string;
  itemFree: string;
  itemCustomPrice: string;
  adminPasswordTitle: string;
  adminPasswordHint: string;
  adminPassword: string;
  adminPasswordWrong: string;
  confirmWithPassword: string;
  toastPrinted: string;
  toastPrintedEdge: string;
  toastPrintFail: string;
  toastCash: string;
  toastCard: string;
  toastClosed: string;
  toastOrderSent: string;
  billHistory: string;
  noBillHistory: string;
  closedAt: string;
  tipTotal: string;
  methodCash: string;
  methodCard: string;
  viewBill: string;
  resetPassword: string;
  resetPasswordHint: string;
  toastPasswordReset: string;
  linkPickup: string;
  pickupCallWaiterBadge: string;
  pickupCallWaiterTitle: string;
  pickupCallWaiterName: string;
  pickupCallWaiterOrderRef: string;
  pickupCallWaiterComment: string;
  pickupCallWaiterDismiss: string;
  featureDisabledTitle: string;
  featureDisabledBody: string;
};

const en: WaiterMessages = {
  title: "Waiter",
  floor: "My Restaurant · Floor",
  language: "Language",
  sections: {
    INSIDE: "Inside",
    OUTSIDE: "Outside",
    TERRACE: "Terrace",
    ALL: "All",
  },
  legendTitle: "Table status",
  legendFree: "Free — empty table",
  legendActive: "Active — guests ordering",
  legendReady: "Ready — food to serve",
  legendCall: "Call — waiter requested",
  legendBill: "Bill — check requested",
  legendParty: "Guests? — count missing",
  table: "Table",
  billTag: "BILL",
  tabUnpaid: "Tab unpaid",
  paid: "Paid",
  printBill: "Print bill",
  addOrder: "Add order",
  payCash: "Pay cash",
  payCard: "Pay card",
  closeTable: "Close table",
  confirmCloseTitle: "Close this table?",
  confirmCloseBody: "This ends the guest visit. Make sure the bill is settled.",
  confirmCloseUnpaid: "There is still an unpaid balance of {amount}.",
  confirmCloseYes: "Yes, close table",
  confirmCloseNo: "Cancel",
  partySize: "Guests at table",
  partySizeHint: "Enter how many people are seated.",
  partySizeAlert: "Set guest count",
  partySizeRequired: "Set the number of guests before closing or taking final payment.",
  partySizeSave: "Save guest count",
  partySizeSaved: "Guest count saved",
  pickupName: "Pickup name",
  pickupNameHint: "Register the guest name for ready-to-pick-up alerts.",
  pickupNamePlaceholder: "Guest name",
  pickupNameSave: "Save name",
  pickupNameSaved: "Pickup name saved",
  takeaway: "Takeaway",
  noSession: "No open session",
  startSession: "Add order (start session)",
  orderLabel: "Order",
  served: "Served",
  back: "Back",
  cashPayment: "Cash payment",
  due: "Due",
  amountReceived: "Amount received",
  tip: "Tip (optional)",
  guestTip: "Guest tip",
  guestTipHint: "Guest already chose this tip — adjust if needed",
  askTipHint: "Ask the guest for a tip, then enter it here",
  totalWithTip: "Total",
  tipPercent: "Percentage",
  tipFixed: "Amount ₪",
  tipPercentPlaceholder: "e.g. 10",
  tipAmountPlaceholder: "0.00",
  tipNone: "No tip",
  change: "Change",
  confirmCash: "Confirm cash & close",
  cardPayment: "Card payment",
  cardHint: "Charge on the terminal, then confirm.",
  cardRef: "Terminal ref / last 4 (optional)",
  confirmCard: "Confirm card paid & close",
  kitchenNote: "Kitchen note for this order (optional)",
  sendKitchen: "Send to kitchen",
  menuSearch: "Search menu…",
  menuAll: "All",
  itemFree: "Free",
  itemCustomPrice: "Custom price",
  adminPasswordTitle: "Admin approval",
  adminPasswordHint: "Free or custom-price items need the admin password.",
  adminPassword: "Admin password",
  adminPasswordWrong: "Wrong admin password",
  confirmWithPassword: "Confirm & send",
  toastPrinted: "Bill ready to print",
  toastPrintedEdge: "Bill sent to printer",
  toastPrintFail: "Could not print bill",
  toastCash: "Paid by cash — table closed",
  toastCard: "Paid by card — table closed",
  toastClosed: "Table closed",
  toastOrderSent: "Order sent to kitchen",
  billHistory: "Bill history",
  noBillHistory: "No past bills for this table",
  closedAt: "Closed",
  tipTotal: "Tips",
  methodCash: "Cash",
  methodCard: "Card",
  viewBill: "View",
  resetPassword: "Reset guest password",
  resetPasswordHint: "Guest can refresh and set a new password. Orders stay open.",
  toastPasswordReset: "Password cleared — guest can set a new one",
  linkPickup: "Pickup queue",
  pickupCallWaiterBadge: "Pickup guest needs help",
  pickupCallWaiterTitle: "Call a waiter",
  pickupCallWaiterName: "Guest",
  pickupCallWaiterOrderRef: "Order / table",
  pickupCallWaiterComment: "Comment",
  pickupCallWaiterDismiss: "Got it",
  featureDisabledTitle: "Ordering not in your package",
  featureDisabledBody: "Table ordering is turned off. Enable it under Admin → Package.",
};

const ar: WaiterMessages = {
  title: "النادل",
  floor: "مطعمي · الصالة",
  language: "اللغة",
  sections: {
    INSIDE: "داخلي",
    OUTSIDE: "خارجي",
    TERRACE: "تراس",
    ALL: "الكل",
  },
  legendTitle: "حالة الطاولة",
  legendFree: "فارغة",
  legendActive: "نشطة — يطلبون",
  legendReady: "جاهز — للتقديم",
  legendCall: "نداء — طلب نادل",
  legendBill: "فاتورة — طلب الحساب",
  legendParty: "الضيوف؟ — العدد ناقص",
  table: "طاولة",
  billTag: "فاتورة",
  tabUnpaid: "المتبقي",
  paid: "مدفوع",
  printBill: "طباعة الفاتورة",
  addOrder: "إضافة طلب",
  payCash: "دفع نقدي",
  payCard: "دفع بالبطاقة",
  closeTable: "إغلاق الطاولة",
  confirmCloseTitle: "إغلاق هذه الطاولة؟",
  confirmCloseBody: "سينتهي جلوس الضيف. تأكد أن الفاتورة مُسدّدة.",
  confirmCloseUnpaid: "ما زال هناك مبلغ غير مدفوع: {amount}.",
  confirmCloseYes: "نعم، أغلق الطاولة",
  confirmCloseNo: "إلغاء",
  partySize: "عدد الضيوف",
  partySizeHint: "أدخل عدد الأشخاص على الطاولة.",
  partySizeAlert: "حدد عدد الضيوف",
  partySizeRequired: "يجب تحديد عدد الضيوف قبل الإغلاق أو الدفع النهائي.",
  partySizeSave: "حفظ عدد الضيوف",
  partySizeSaved: "تم حفظ عدد الضيوف",
  pickupName: "اسم الاستلام",
  pickupNameHint: "سجّل اسم الضيف لإشعارات جاهزية الطلب.",
  pickupNamePlaceholder: "اسم الضيف",
  pickupNameSave: "حفظ الاسم",
  pickupNameSaved: "تم حفظ اسم الاستلام",
  takeaway: "سفري",
  noSession: "لا توجد جلسة مفتوحة",
  startSession: "إضافة طلب (بدء جلسة)",
  orderLabel: "طلب",
  served: "تم التقديم",
  back: "رجوع",
  cashPayment: "دفع نقدي",
  due: "المستحق",
  amountReceived: "المبلغ المستلم",
  tip: "بقشيش (اختياري)",
  guestTip: "بقشيش الضيف",
  guestTipHint: "الضيف اختار هذا البقشيش — يمكن تعديله",
  askTipHint: "اسأل الضيف عن البقشيش ثم أدخله هنا",
  totalWithTip: "الإجمالي",
  tipPercent: "نسبة مئوية",
  tipFixed: "مبلغ ₪",
  tipPercentPlaceholder: "مثال: 10",
  tipAmountPlaceholder: "0.00",
  tipNone: "بدون بقشيش",
  change: "الباقي",
  confirmCash: "تأكيد النقدي وإغلاق",
  cardPayment: "دفع بالبطاقة",
  cardHint: "اشحن على الجهاز ثم أكّد.",
  cardRef: "مرجع الجهاز / آخر 4 (اختياري)",
  confirmCard: "تأكيد الدفع بالبطاقة وإغلاق",
  kitchenNote: "ملاحظة للمطبخ (اختياري)",
  sendKitchen: "إرسال للمطبخ",
  menuSearch: "ابحث في القائمة…",
  menuAll: "الكل",
  itemFree: "مجاني",
  itemCustomPrice: "سعر مخصص",
  adminPasswordTitle: "موافقة المدير",
  adminPasswordHint: "الأصناف المجانية أو ذات السعر المخصص تحتاج كلمة مرور المدير.",
  adminPassword: "كلمة مرور المدير",
  adminPasswordWrong: "كلمة مرور المدير غير صحيحة",
  confirmWithPassword: "تأكيد وإرسال",
  toastPrinted: "الفاتورة جاهزة للطباعة",
  toastPrintedEdge: "تم إرسال الفاتورة للطابعة",
  toastPrintFail: "تعذّرت طباعة الفاتورة",
  toastCash: "تم الدفع نقداً — أُغلقت الطاولة",
  toastCard: "تم الدفع بالبطاقة — أُغلقت الطاولة",
  toastClosed: "أُغلقت الطاولة",
  toastOrderSent: "أُرسل الطلب للمطبخ",
  billHistory: "سجل الفواتير",
  noBillHistory: "لا توجد فواتير سابقة لهذه الطاولة",
  closedAt: "أُغلقت",
  tipTotal: "بقشيش",
  methodCash: "نقدي",
  methodCard: "بطاقة",
  viewBill: "عرض",
  resetPassword: "إعادة تعيين كلمة مرور الضيف",
  resetPasswordHint: "يمكن للضيف التحديث واختيار كلمة مرور جديدة. الطلبات تبقى.",
  toastPasswordReset: "تم مسح كلمة المرور — يمكن للضيف تعيين واحدة جديدة",
  linkPickup: "طابور الاستلام",
  pickupCallWaiterBadge: "ضيف الاستلام يحتاج مساعدة",
  pickupCallWaiterTitle: "استدعاء نادل",
  pickupCallWaiterName: "الضيف",
  pickupCallWaiterOrderRef: "طلب / طاولة",
  pickupCallWaiterComment: "ملاحظة",
  pickupCallWaiterDismiss: "تم",
  featureDisabledTitle: "الطلب غير مفعّل في باقتك",
  featureDisabledBody: "طلب الطاولات متوقف. فعّله من الإدارة ← الباقة.",
};

const he: WaiterMessages = {
  title: "מלצר",
  floor: "המסעדה שלי · רצפה",
  language: "שפה",
  sections: {
    INSIDE: "פנים",
    OUTSIDE: "חוץ",
    TERRACE: "מרפסת",
    ALL: "הכל",
  },
  legendTitle: "סטטוס שולחן",
  legendFree: "פנוי",
  legendActive: "פעיל — מזמינים",
  legendReady: "מוכן — להגשה",
  legendCall: "קריאה — מלצר",
  legendBill: "חשבון — התבקש",
  legendParty: "אורחים? — חסר מספר",
  table: "שולחן",
  billTag: "חשבון",
  tabUnpaid: "יתרה לתשלום",
  paid: "שולם",
  printBill: "הדפס חשבון",
  addOrder: "הוסף הזמנה",
  payCash: "תשלום מזומן",
  payCard: "תשלום בכרטיס",
  closeTable: "סגור שולחן",
  confirmCloseTitle: "לסגור את השולחן?",
  confirmCloseBody: "הביקור של האורח יסתיים. ודאו שהחשבון שולם.",
  confirmCloseUnpaid: "עדיין יש יתרה לתשלום של {amount}.",
  confirmCloseYes: "כן, סגור שולחן",
  confirmCloseNo: "ביטול",
  partySize: "מספר אורחים",
  partySizeHint: "הזינו כמה אנשים יושבים בשולחן.",
  partySizeAlert: "הגדירו מספר אורחים",
  partySizeRequired: "יש להגדיר את מספר האורחים לפני סגירה או תשלום סופי.",
  partySizeSave: "שמירת מספר אורחים",
  partySizeSaved: "מספר האורחים נשמר",
  pickupName: "שם לאיסוף",
  pickupNameHint: "רשמו את שם האורח להתראות מוכן לאיסוף.",
  pickupNamePlaceholder: "שם האורח",
  pickupNameSave: "שמירת שם",
  pickupNameSaved: "שם האיסוף נשמר",
  takeaway: "לקחת",
  noSession: "אין הפעלה פתוחה",
  startSession: "הוסף הזמנה (התחל הפעלה)",
  orderLabel: "הזמנה",
  served: "הוגש",
  back: "חזרה",
  cashPayment: "תשלום מזומן",
  due: "לתשלום",
  amountReceived: "סכום שהתקבל",
  tip: "טיפ (אופציונלי)",
  guestTip: "טיפ האורח",
  guestTipHint: "האורח בחר טיפ זה — ניתן לעדכן",
  askTipHint: "שאלו את האורח על טיפ והזינו כאן",
  totalWithTip: "סה״כ",
  tipPercent: "אחוז",
  tipFixed: "סכום ₪",
  tipPercentPlaceholder: "לדוגמה 10",
  tipAmountPlaceholder: "0.00",
  tipNone: "בלי טיפ",
  change: "עודף",
  confirmCash: "אשר מזומן וסגור",
  cardPayment: "תשלום בכרטיס",
  cardHint: "חייב במסוף ואז אשר.",
  cardRef: "אסמכתא / 4 ספרות (אופציונלי)",
  confirmCard: "אשר כרטיס וסגור",
  kitchenNote: "הערה למטבח (אופציונלי)",
  sendKitchen: "שלח למטבח",
  menuSearch: "חיפוש בתפריט…",
  menuAll: "הכל",
  itemFree: "חינם",
  itemCustomPrice: "מחיר מותאם",
  adminPasswordTitle: "אישור מנהל",
  adminPasswordHint: "פריטים חינם או במחיר מותאם דורשים סיסמת מנהל.",
  adminPassword: "סיסמת מנהל",
  adminPasswordWrong: "סיסמת מנהל שגויה",
  confirmWithPassword: "אשר ושלח",
  toastPrinted: "החשבון מוכן להדפסה",
  toastPrintedEdge: "החשבון נשלח למדפסת",
  toastPrintFail: "לא ניתן להדפיס",
  toastCash: "שולם במזומן — השולחן נסגר",
  toastCard: "שולם בכרטיס — השולחן נסגר",
  toastClosed: "השולחן נסגר",
  toastOrderSent: "ההזמנה נשלחה למטבח",
  billHistory: "היסטוריית חשבונות",
  noBillHistory: "אין חשבונות קודמים לשולחן זה",
  closedAt: "נסגר",
  tipTotal: "טיפים",
  methodCash: "מזומן",
  methodCard: "כרטיס",
  viewBill: "הצג",
  resetPassword: "איפוס סיסמת אורח",
  resetPasswordHint: "האורח יכול לרענן ולבחור סיסמה חדשה. ההזמנות נשארות.",
  toastPasswordReset: "הסיסמה אופסה — האורח יכול לבחור חדשה",
  linkPickup: "תור איסוף",
  pickupCallWaiterBadge: "אורח איסוף צריך עזרה",
  pickupCallWaiterTitle: "קריאה למלצר",
  pickupCallWaiterName: "אורח",
  pickupCallWaiterOrderRef: "הזמנה / שולחן",
  pickupCallWaiterComment: "הערה",
  pickupCallWaiterDismiss: "הבנתי",
  featureDisabledTitle: "הזמנות אינן כלולות בחבילה",
  featureDisabledBody: "הזמנות שולחן כבויות. הפעילו תחת ניהול ← חבילה.",
};

const ru: WaiterMessages = {
  title: "Официант",
  floor: "Мой ресторан · Зал",
  language: "Язык",
  sections: {
    INSIDE: "Внутри",
    OUTSIDE: "Снаружи",
    TERRACE: "Терраса",
    ALL: "Все",
  },
  legendTitle: "Статус стола",
  legendFree: "Свободен",
  legendActive: "Активен — заказ",
  legendReady: "Готово — подать",
  legendCall: "Вызов — официант",
  legendBill: "Счёт — запрошен",
  legendParty: "Гости? — нет числа",
  table: "Стол",
  billTag: "СЧЁТ",
  tabUnpaid: "К оплате",
  paid: "Оплачено",
  printBill: "Печать счёта",
  addOrder: "Добавить заказ",
  payCash: "Наличные",
  payCard: "Карта",
  closeTable: "Закрыть стол",
  confirmCloseTitle: "Закрыть этот стол?",
  confirmCloseBody: "Визит гостя завершится. Убедитесь, что счёт оплачен.",
  confirmCloseUnpaid: "Есть неоплаченный остаток {amount}.",
  confirmCloseYes: "Да, закрыть стол",
  confirmCloseNo: "Отмена",
  partySize: "Гостей за столом",
  partySizeHint: "Укажите, сколько человек сидит.",
  partySizeAlert: "Укажите число гостей",
  partySizeRequired: "Укажите число гостей перед закрытием или финальной оплатой.",
  partySizeSave: "Сохранить число гостей",
  partySizeSaved: "Число гостей сохранено",
  pickupName: "Имя для выдачи",
  pickupNameHint: "Зарегистрируйте имя гостя для уведомлений «готово к выдаче».",
  pickupNamePlaceholder: "Имя гостя",
  pickupNameSave: "Сохранить имя",
  pickupNameSaved: "Имя для выдачи сохранено",
  takeaway: "С собой",
  noSession: "Нет открытой сессии",
  startSession: "Добавить заказ (начать)",
  orderLabel: "Заказ",
  served: "Подано",
  back: "Назад",
  cashPayment: "Оплата наличными",
  due: "К оплате",
  amountReceived: "Получено",
  tip: "Чаевые (необяз.)",
  guestTip: "Чаевые гостя",
  guestTipHint: "Гость уже указал чаевые — можно изменить",
  askTipHint: "Спросите гостя о чаевых и введите здесь",
  totalWithTip: "Итого",
  tipPercent: "Процент",
  tipFixed: "Сумма ₪",
  tipPercentPlaceholder: "напр. 10",
  tipAmountPlaceholder: "0.00",
  tipNone: "Без чаевых",
  change: "Сдача",
  confirmCash: "Подтвердить наличные и закрыть",
  cardPayment: "Оплата картой",
  cardHint: "Проведите на терминале, затем подтвердите.",
  cardRef: "Ссылка / последние 4 (необяз.)",
  confirmCard: "Подтвердить карту и закрыть",
  kitchenNote: "Заметка на кухню (необяз.)",
  sendKitchen: "Отправить на кухню",
  menuSearch: "Поиск в меню…",
  menuAll: "Все",
  itemFree: "Бесплатно",
  itemCustomPrice: "Своя цена",
  adminPasswordTitle: "Подтверждение админа",
  adminPasswordHint: "Бесплатные позиции или своя цена требуют пароль администратора.",
  adminPassword: "Пароль администратора",
  adminPasswordWrong: "Неверный пароль администратора",
  confirmWithPassword: "Подтвердить и отправить",
  toastPrinted: "Счёт готов к печати",
  toastPrintedEdge: "Счёт отправлен на принтер",
  toastPrintFail: "Не удалось напечатать",
  toastCash: "Оплачено наличными — стол закрыт",
  toastCard: "Оплачено картой — стол закрыт",
  toastClosed: "Стол закрыт",
  toastOrderSent: "Заказ отправлен на кухню",
  billHistory: "История счетов",
  noBillHistory: "Нет прошлых счетов для этого стола",
  closedAt: "Закрыт",
  tipTotal: "Чаевые",
  methodCash: "Наличные",
  methodCard: "Карта",
  viewBill: "Открыть",
  resetPassword: "Сбросить пароль гостя",
  resetPasswordHint: "Гость может обновить страницу и задать новый пароль. Заказы сохраняются.",
  toastPasswordReset: "Пароль сброшен — гость может задать новый",
  linkPickup: "Очередь самовывоза",
  pickupCallWaiterBadge: "Гостю самовывоза нужна помощь",
  pickupCallWaiterTitle: "Вызов официанта",
  pickupCallWaiterName: "Гость",
  pickupCallWaiterOrderRef: "Заказ / стол",
  pickupCallWaiterComment: "Комментарий",
  pickupCallWaiterDismiss: "Понятно",
  featureDisabledTitle: "Заказы не входят в пакет",
  featureDisabledBody: "Заказы со стола выключены. Включите в Админ → Пакет.",
};

export const waiterMessages: Record<Locale, WaiterMessages> = { en, ar, he, ru };

export type KitchenMessages = {
  title: string;
  floor: string;
  language: string;
  loading: string;
  empty: string;
  tapNext: string;
  done: string;
  dragHint: string;
  takeaway: string;
  groupSimilar: string;
  tables: string;
  linkPickup: string;
  stations: Record<"MAIN_KITCHEN" | "MEAT_KITCHEN" | "BAR" | "ALL", string>;
  columns: Record<"RECEIVED" | "PREPARING" | "READY", string>;
  featureDisabledTitle: string;
  featureDisabledBody: string;
};

const kitchenEn: KitchenMessages = {
  title: "Kitchen Display System",
  floor: "My Restaurant · Kitchen Display System",
  language: "Language",
  loading: "Loading…",
  empty: "Empty",
  tapNext: "Tap →",
  done: "served / clear",
  dragHint: "Drag cards between columns · tap to advance",
  takeaway: "TAKEAWAY",
  groupSimilar: "Group similar items",
  tables: "Tables",
  linkPickup: "Pickup queue",
  stations: {
    MAIN_KITCHEN: "Main kitchen",
    MEAT_KITCHEN: "Meat kitchen",
    BAR: "Bar",
    ALL: "All stations",
  },
  columns: {
    RECEIVED: "New",
    PREPARING: "Preparing",
    READY: "Ready",
  },
  featureDisabledTitle: "Ordering not in your package",
  featureDisabledBody: "Kitchen display needs table ordering. Enable it under Admin → Package.",
};

const kitchenAr: KitchenMessages = {
  title: "نظام عرض المطبخ",
  floor: "مطعمي · نظام عرض المطبخ",
  language: "اللغة",
  loading: "جاري التحميل…",
  empty: "فارغ",
  tapNext: "اضغط ←",
  done: "تقديم / إزالة",
  dragHint: "اسحب البطاقات بين الأعمدة · اضغط للتقدّم",
  takeaway: "سفري",
  groupSimilar: "تجميع الأصناف المتشابهة",
  tables: "طاولات",
  linkPickup: "طابور الاستلام",
  stations: {
    MAIN_KITCHEN: "المطبخ الرئيسي",
    MEAT_KITCHEN: "مطبخ اللحوم",
    BAR: "البار",
    ALL: "كل المحطات",
  },
  columns: {
    RECEIVED: "جديد",
    PREPARING: "قيد التحضير",
    READY: "جاهز",
  },
  featureDisabledTitle: "الطلب غير مفعّل في باقتك",
  featureDisabledBody: "شاشة المطبخ تحتاج طلب الطاولات. فعّله من الإدارة ← الباقة.",
};

const kitchenHe: KitchenMessages = {
  title: "מערכת תצוגת מטבח",
  floor: "המסעדה שלי · מערכת תצוגת מטבח",
  language: "שפה",
  loading: "טוען…",
  empty: "ריק",
  tapNext: "הקש ←",
  done: "הוגש / נקה",
  dragHint: "גררו כרטיסים בין העמודות · הקשה להתקדמות",
  takeaway: "לקחת",
  groupSimilar: "קיבוץ פריטים דומים",
  tables: "שולחנות",
  linkPickup: "תור איסוף",
  stations: {
    MAIN_KITCHEN: "מטבח ראשי",
    MEAT_KITCHEN: "מטבח בשר",
    BAR: "בר",
    ALL: "כל התחנות",
  },
  columns: {
    RECEIVED: "חדש",
    PREPARING: "בהכנה",
    READY: "מוכן",
  },
  featureDisabledTitle: "הזמנות אינן כלולות בחבילה",
  featureDisabledBody: "תצוגת מטבח דורשת הזמנות שולחן. הפעילו תחת ניהול ← חבילה.",
};

const kitchenRu: KitchenMessages = {
  title: "Кухонный дисплей",
  floor: "Мой ресторан · Кухонный дисплей",
  language: "Язык",
  loading: "Загрузка…",
  empty: "Пусто",
  tapNext: "Нажми →",
  done: "подано / убрать",
  dragHint: "Перетаскивайте карточки между колонками · нажатие — дальше",
  takeaway: "С СОБОЙ",
  groupSimilar: "Группировать похожие",
  tables: "Столы",
  linkPickup: "Очередь самовывоза",
  stations: {
    MAIN_KITCHEN: "Основная кухня",
    MEAT_KITCHEN: "Мясная кухня",
    BAR: "Бар",
    ALL: "Все станции",
  },
  columns: {
    RECEIVED: "Новые",
    PREPARING: "Готовится",
    READY: "Готово",
  },
  featureDisabledTitle: "Заказы не входят в пакет",
  featureDisabledBody: "Кухонный дисплей нужен для заказов со стола. Включите в Админ → Пакет.",
};

export const kitchenMessages: Record<Locale, KitchenMessages> = {
  en: kitchenEn,
  ar: kitchenAr,
  he: kitchenHe,
  ru: kitchenRu,
};

export type AdminMessages = {
  title: string;
  language: string;
  navDashboard: string;
  navMenu: string;
  navTables: string;
  navLinks: string;
  navPackage: string;
  linkKitchen: string;
  linkWaiter: string;
  linkPickup: string;
  linkAlerts: string;
  venueFallback: string;
  revenueToday: string;
  ordersToday: string;
  openTables: string;
  avgCheck: string;
  menuItemsLive: string;
  pickupWaiting: string;
  pickupReady: string;
  liveFeed: string;
  pickupFeed: string;
  noOrders: string;
  noPickupTickets: string;
  menuOnlyDashHint: string;
  manageMenuCta: string;
  openPackageCta: string;
  menuTitle: string;
  editLocale: string;
  nameLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  priceLabel: string;
  availableOnMenu: string;
  imageLabel: string;
  imageHint: string;
  imageChoose: string;
  imageRemove: string;
  imageUploading: string;
  save: string;
  cancel: string;
  on: string;
  off: string;
  edit: string;
  hideItem: string;
  showItem: string;
  hideAll: string;
  showAll: string;
  hiddenBadge: string;
  addCategory: string;
  addCategoryTitle: string;
  createCategory: string;
  categoryNamePlaceholder: string;
  categoryLabel: string;
  editCategory: string;
  translateCategory: string;
  addSubcategory: string;
  addSubcategoryTitle: string;
  deleteCategory: string;
  deleteCategoryConfirm: string;
  deleteCategoryBlocked: string;
  subcategoryBadge: string;
  addItem: string;
  addItemTitle: string;
  createItem: string;
  routeLabel: string;
  routes: Record<"MAIN_KITCHEN" | "MEAT_KITCHEN" | "BAR" | "HOOKAH", string>;
  removeItem: string;
  removeItemConfirm: string;
  removeItemBlocked: string;
  extrasTitle: string;
  extrasHint: string;
  addExtra: string;
  extraNamePlaceholder: string;
  extraPricePlaceholder: string;
  removeExtra: string;
  tablesTitle: string;
  tablesHint: string;
  orderingRequiredTitle: string;
  orderingRequiredBody: string;
  pickupGuestTitle: string;
  pickupGuestHint: string;
  pickupGuestUrlLabel: string;
  menuGuestTitle: string;
  menuGuestHint: string;
  menuGuestHintOrdering: string;
  alertsBoardTitle: string;
  alertsBoardHint: string;
  copyLink: string;
  linkCopied: string;
  colNumber: string;
  colSection: string;
  colStatus: string;
  colGuestUrl: string;
  sections: Record<"INSIDE" | "OUTSIDE" | "TERRACE", string>;
  statuses: Record<"FREE" | "ACTIVE" | "BILL_REQUESTED" | "DISABLED", string>;
  packageTitle: string;
  packageHint: string;
  packageMenuOnly: string;
  packageMenuAlerts: string;
  packageMenuAlertsPickup: string;
  packageMenuOrdering: string;
  packageMenuOnlyDesc: string;
  packageMenuAlertsDesc: string;
  packageMenuAlertsPickupDesc: string;
  packageMenuOrderingDesc: string;
  featureDigitalMenu: string;
  featureAlerts: string;
  featureOrdering: string;
  featurePickup: string;
  featureAlwaysOn: string;
  packageSaved: string;
  packageSaveError: string;
};

const adminEn: AdminMessages = {
  title: "Admin",
  language: "Language",
  navDashboard: "Dashboard",
  navMenu: "Menu",
  navTables: "Tables",
  navLinks: "Guest links",
  navPackage: "Package",
  linkKitchen: "Kitchen",
  linkWaiter: "Waiter",
  linkPickup: "Pickup queue",
  linkAlerts: "Alerts board",
  venueFallback: "Venue",
  revenueToday: "Revenue today",
  ordersToday: "Orders today",
  openTables: "Open tables",
  avgCheck: "Avg check",
  menuItemsLive: "Menu items",
  pickupWaiting: "Pickup waiting",
  pickupReady: "Pickup ready",
  liveFeed: "Live feed",
  pickupFeed: "Recent pickup",
  noOrders: "No orders yet today",
  noPickupTickets: "No pickup tickets yet",
  menuOnlyDashHint: "This venue is on Menu only — manage the digital menu below. Alerts, ordering, and pickup need a package upgrade.",
  manageMenuCta: "Open menu",
  openPackageCta: "Change package",
  menuTitle: "Menu",
  editLocale: "Edit language",
  nameLabel: "Name",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Item description…",
  priceLabel: "Price (₪)",
  availableOnMenu: "Available on menu",
  imageLabel: "Item photo",
  imageHint: "JPEG, PNG, WebP or GIF · max 4MB",
  imageChoose: "Choose photo",
  imageRemove: "Remove photo",
  imageUploading: "Uploading…",
  save: "Save",
  cancel: "Cancel",
  on: "On",
  off: "Off",
  edit: "Edit",
  hideItem: "Hide",
  showItem: "Show",
  hideAll: "Hide all",
  showAll: "Show all",
  hiddenBadge: "Hidden",
  addCategory: "Add category",
  addCategoryTitle: "New category",
  createCategory: "Create category",
  categoryNamePlaceholder: "e.g. Desserts",
  categoryLabel: "Category",
  editCategory: "Rename",
  translateCategory: "Translate",
  addSubcategory: "Add subcategory",
  addSubcategoryTitle: "New subcategory",
  deleteCategory: "Delete category",
  deleteCategoryConfirm: "Delete this category and its empty items/subcategories?",
  deleteCategoryBlocked:
    "This category has items that were ordered before and cannot be deleted. Hide them instead.",
  subcategoryBadge: "Sub",
  addItem: "Add item",
  addItemTitle: "New item",
  createItem: "Create",
  routeLabel: "Kitchen route",
  routes: {
    MAIN_KITCHEN: "Main kitchen",
    MEAT_KITCHEN: "Meat kitchen",
    BAR: "Bar",
    HOOKAH: "Hookah",
  },
  removeItem: "Remove",
  removeItemConfirm: "Remove this item from the menu?",
  removeItemBlocked: "This item was ordered before and cannot be deleted. Turn it Off instead.",
  extrasTitle: "Add-ons",
  extrasHint: "Optional extras guests can tick (name + price).",
  addExtra: "Add extra",
  extraNamePlaceholder: "e.g. Extra cheese",
  extraPricePlaceholder: "Price",
  removeExtra: "Remove",
  tablesTitle: "Tables & QR",
  tablesHint: "Program NTAG215 with the guest URL. Print the same URL as QR.",
  orderingRequiredTitle: "Table ordering not in this package",
  orderingRequiredBody:
    "Table sessions, floor status, and per-table guest URLs need the Ordering package. Switch package to enable them.",
  pickupGuestTitle: "Pickup guest link",
  pickupGuestHint:
    "Share or print this URL / QR for guests who order for pickup — not table-session ordering.",
  pickupGuestUrlLabel: "Pickup URL",
  menuGuestTitle: "Guest menu link",
  menuGuestHint:
    "Share this public menu link — guests can browse and call a waiter (no table QR).",
  menuGuestHintOrdering:
    "Share this public menu link — guests browse, enter their table number, register, and order (table QR still works).",
  alertsBoardTitle: "Alerts board",
  alertsBoardHint:
    "Staff screen for waiter calls — includes the pickup queue when that package is on.",
  copyLink: "Copy link",
  linkCopied: "Copied",
  colNumber: "#",
  colSection: "Section",
  colStatus: "Status",
  colGuestUrl: "Guest URL",
  sections: {
    INSIDE: "Inside",
    OUTSIDE: "Outside",
    TERRACE: "Terrace",
  },
  statuses: {
    FREE: "Free",
    ACTIVE: "Active",
    BILL_REQUESTED: "Bill requested",
    DISABLED: "Disabled",
  },
  packageTitle: "Customer package",
  packageHint:
    "Digital Menu is always included. Pick the guest experience this venue should offer.",
  packageMenuOnly: "Menu only",
  packageMenuAlerts: "Menu + alerts system",
  packageMenuAlertsPickup: "Menu + alerts + pickup",
  packageMenuOrdering: "Menu + ordering",
  packageMenuOnlyDesc: "Public menu link for guests",
  packageMenuAlertsDesc: "Public menu link + waiter call alerts (no table QR)",
  packageMenuAlertsPickupDesc: "Pickup link with menu inside + waiter alerts",
  packageMenuOrderingDesc:
    "Public menu link (enter table number) + optional table QR for full ordering",
  featureDigitalMenu: "Digital Menu",
  featureAlerts: "Waiter alerts / call waiter",
  featureOrdering: "Table ordering",
  featurePickup: "Pickup system",
  featureAlwaysOn: "Always on",
  packageSaved: "Package saved",
  packageSaveError: "Could not save package",
};

const adminAr: AdminMessages = {
  title: "الإدارة",
  language: "اللغة",
  navDashboard: "لوحة التحكم",
  navMenu: "القائمة",
  navTables: "الطاولات",
  navLinks: "روابط الضيوف",
  navPackage: "الباقة",
  linkKitchen: "المطبخ",
  linkWaiter: "النادل",
  linkPickup: "طابور الاستلام",
  linkAlerts: "لوحة التنبيهات",
  venueFallback: "المطعم",
  revenueToday: "إيراد اليوم",
  ordersToday: "طلبات اليوم",
  openTables: "طاولات مفتوحة",
  avgCheck: "متوسط الفاتورة",
  menuItemsLive: "أصناف القائمة",
  pickupWaiting: "استلام بالانتظار",
  pickupReady: "استلام جاهز",
  liveFeed: "البث المباشر",
  pickupFeed: "استلام حديث",
  noOrders: "لا طلبات اليوم بعد",
  noPickupTickets: "لا تذاكر استلام بعد",
  menuOnlyDashHint:
    "هذا المطعم على باقة القائمة فقط — أدِر القائمة الرقمية أدناه. طلب الطاولات والاستلام يحتاجان ترقية الباقة.",
  manageMenuCta: "فتح القائمة",
  openPackageCta: "تغيير الباقة",
  menuTitle: "القائمة",
  editLocale: "لغة التعديل",
  nameLabel: "الاسم",
  descriptionLabel: "الوصف",
  descriptionPlaceholder: "وصف الصنف…",
  priceLabel: "السعر (₪)",
  availableOnMenu: "متوفر في القائمة",
  imageLabel: "صورة الصنف",
  imageHint: "JPEG أو PNG أو WebP أو GIF · حتى 4MB",
  imageChoose: "اختر صورة",
  imageRemove: "إزالة الصورة",
  imageUploading: "جاري الرفع…",
  save: "حفظ",
  cancel: "إلغاء",
  on: "مفعّل",
  off: "متوقف",
  edit: "تعديل",
  hideItem: "إخفاء",
  showItem: "إظهار",
  hideAll: "إخفاء الكل",
  showAll: "إظهار الكل",
  hiddenBadge: "مخفي",
  addCategory: "إضافة فئة",
  addCategoryTitle: "فئة جديدة",
  createCategory: "إنشاء الفئة",
  categoryNamePlaceholder: "مثال: حلويات",
  categoryLabel: "الفئة",
  editCategory: "إعادة تسمية",
  translateCategory: "ترجمة",
  addSubcategory: "إضافة فئة فرعية",
  addSubcategoryTitle: "فئة فرعية جديدة",
  deleteCategory: "حذف الفئة",
  deleteCategoryConfirm: "حذف هذه الفئة وعناصرها/فئاتها الفرعية الفارغة؟",
  deleteCategoryBlocked:
    "هذه الفئة تحتوي أصنافاً طُلبت سابقاً ولا يمكن حذفها. أخفِها بدلاً من ذلك.",
  subcategoryBadge: "فرعي",
  addItem: "إضافة صنف",
  addItemTitle: "صنف جديد",
  createItem: "إنشاء",
  routeLabel: "مسار المطبخ",
  routes: {
    MAIN_KITCHEN: "المطبخ الرئيسي",
    MEAT_KITCHEN: "مطبخ اللحوم",
    BAR: "البار",
    HOOKAH: "الشيشة",
  },
  removeItem: "حذف",
  removeItemConfirm: "هل تريد حذف هذا الصنف من القائمة؟",
  removeItemBlocked: "تم طلب هذا الصنف سابقاً ولا يمكن حذفه. أوقفه بدلاً من ذلك.",
  extrasTitle: "إضافات",
  extrasHint: "إضافات اختيارية يضع عليها الضيف علامة (اسم + سعر).",
  addExtra: "إضافة خيار",
  extraNamePlaceholder: "مثال: جبنة إضافية",
  extraPricePlaceholder: "السعر",
  removeExtra: "حذف",
  tablesTitle: "الطاولات وQR",
  tablesHint: "برمج NTAG215 برابط الضيف. اطبع نفس الرابط كـ QR.",
  orderingRequiredTitle: "طلب الطاولات غير مشمول في هذه الباقة",
  orderingRequiredBody:
    "جلسات الطاولات وحالة القاعة وروابط الضيوف لكل طاولة تحتاج باقة الطلب. غيّر الباقة لتفعيلها.",
  pickupGuestTitle: "رابط ضيف الاستلام",
  pickupGuestHint:
    "شارك أو اطبع هذا الرابط / QR للضيوف الذين يطلبون للاستلام — وليس لجلسات الطاولات.",
  pickupGuestUrlLabel: "رابط الاستلام",
  menuGuestTitle: "رابط قائمة الضيوف",
  menuGuestHint:
    "شارك رابط القائمة العامة — يمكن للضيوف التصفح واستدعاء النادل (بدون QR للطاولة).",
  menuGuestHintOrdering:
    "شارك رابط القائمة العامة — الضيوف يتصفحون ويدخلون رقم الطاولة ويسجّلون ويطلبون (QR الطاولة ما زال يعمل).",
  alertsBoardTitle: "لوحة التنبيهات",
  alertsBoardHint:
    "شاشة الموظفين لاستدعاءات النادل — تتضمن طابور الاستلام عند تفعيل تلك الباقة.",
  copyLink: "نسخ الرابط",
  linkCopied: "تم النسخ",
  colNumber: "#",
  colSection: "القسم",
  colStatus: "الحالة",
  colGuestUrl: "رابط الضيف",
  sections: {
    INSIDE: "داخلي",
    OUTSIDE: "خارجي",
    TERRACE: "تراس",
  },
  statuses: {
    FREE: "فارغة",
    ACTIVE: "نشطة",
    BILL_REQUESTED: "طلب فاتورة",
    DISABLED: "معطّلة",
  },
  packageTitle: "باقة العميل",
  packageHint: "القائمة الرقمية دائماً مشمولة. اختر الميزات الاختيارية لهذا المطعم.",
  packageMenuOnly: "القائمة فقط",
  packageMenuAlerts: "القائمة + نظام التنبيهات",
  packageMenuAlertsPickup: "القائمة + التنبيهات + الاستلام",
  packageMenuOrdering: "القائمة + الطلب",
  packageMenuOnlyDesc: "رابط القائمة العامة للضيوف",
  packageMenuAlertsDesc: "رابط القائمة العامة + تنبيهات استدعاء النادل (بدون QR للطاولة)",
  packageMenuAlertsPickupDesc: "رابط الاستلام مع القائمة داخله + تنبيهات النادل",
  packageMenuOrderingDesc:
    "رابط القائمة العامة (إدخال رقم الطاولة) + QR اختياري للطاولة للطلب الكامل",
  featureDigitalMenu: "القائمة الرقمية",
  featureAlerts: "تنبيهات النادل / استدعاء النادل",
  featureOrdering: "طلب الطاولات",
  featurePickup: "نظام الاستلام",
  featureAlwaysOn: "دائماً مفعّل",
  packageSaved: "تم حفظ الباقة",
  packageSaveError: "تعذّر حفظ الباقة",
};

const adminHe: AdminMessages = {
  title: "ניהול",
  language: "שפה",
  navDashboard: "לוח בקרה",
  navMenu: "תפריט",
  navTables: "שולחנות",
  navLinks: "קישורי אורחים",
  navPackage: "חבילה",
  linkKitchen: "מטבח",
  linkWaiter: "מלצר",
  linkPickup: "תור איסוף",
  linkAlerts: "לוח התראות",
  venueFallback: "מקום",
  revenueToday: "הכנסות היום",
  ordersToday: "הזמנות היום",
  openTables: "שולחנות פתוחים",
  avgCheck: "ממוצע חשבון",
  menuItemsLive: "פריטי תפריט",
  pickupWaiting: "איסוף ממתין",
  pickupReady: "איסוף מוכן",
  liveFeed: "פיד חי",
  pickupFeed: "איסוף אחרון",
  noOrders: "אין הזמנות היום עדיין",
  noPickupTickets: "אין כרטיסי איסוף עדיין",
  menuOnlyDashHint:
    "המקום בחבילת תפריט בלבד — נהלו את התפריט הדיגיטלי למטה. הזמנות שולחן ואיסוף דורשים שדרוג חבילה.",
  manageMenuCta: "פתחו תפריט",
  openPackageCta: "שינוי חבילה",
  menuTitle: "תפריט",
  editLocale: "שפת עריכה",
  nameLabel: "שם",
  descriptionLabel: "תיאור",
  descriptionPlaceholder: "תיאור הפריט…",
  priceLabel: "מחיר (₪)",
  availableOnMenu: "זמין בתפריט",
  imageLabel: "תמונת המנה",
  imageHint: "JPEG, PNG, WebP או GIF · עד 4MB",
  imageChoose: "בחרו תמונה",
  imageRemove: "הסרת תמונה",
  imageUploading: "מעלה…",
  save: "שמור",
  cancel: "ביטול",
  on: "פעיל",
  off: "כבוי",
  edit: "ערוך",
  hideItem: "הסתרה",
  showItem: "הצגה",
  hideAll: "הסתרת הכל",
  showAll: "הצגת הכל",
  hiddenBadge: "מוסתר",
  addCategory: "הוספת קטגוריה",
  addCategoryTitle: "קטגוריה חדשה",
  createCategory: "יצירת קטגוריה",
  categoryNamePlaceholder: "לדוגמה: קינוחים",
  categoryLabel: "קטגוריה",
  editCategory: "שינוי שם",
  translateCategory: "תרגום",
  addSubcategory: "הוספת תת־קטגוריה",
  addSubcategoryTitle: "תת־קטגוריה חדשה",
  deleteCategory: "מחיקת קטגוריה",
  deleteCategoryConfirm: "למחוק את הקטגוריה ואת הפריטים/תתי־הקטגוריות הריקים שלה?",
  deleteCategoryBlocked:
    "בקטגוריה יש פריטים שהוזמנו בעבר ולא ניתן למחוק. הסתירו אותם במקום.",
  subcategoryBadge: "תת",
  addItem: "הוספת פריט",
  addItemTitle: "פריט חדש",
  createItem: "יצירה",
  routeLabel: "מסלול מטבח",
  routes: {
    MAIN_KITCHEN: "מטבח ראשי",
    MEAT_KITCHEN: "מטבח בשר",
    BAR: "בר",
    HOOKAH: "נרגילה",
  },
  removeItem: "הסרה",
  removeItemConfirm: "להסיר את הפריט מהתפריט?",
  removeItemBlocked: "הפריט הוזמן בעבר ולא ניתן למחוק אותו. כבו אותו במקום.",
  extrasTitle: "תוספות",
  extrasHint: "תוספות אופציונליות שהאורח יכול לסמן (שם + מחיר).",
  addExtra: "הוספת תוספת",
  extraNamePlaceholder: "לדוגמה: גבינה נוספת",
  extraPricePlaceholder: "מחיר",
  removeExtra: "הסרה",
  tablesTitle: "שולחנות ו-QR",
  tablesHint: "תכנתו NTAG215 עם כתובת האורח. הדפיסו את אותה כתובת כ-QR.",
  orderingRequiredTitle: "הזמנות שולחן לא כלולות בחבילה",
  orderingRequiredBody:
    "סשנים של שולחנות, סטטוס רצפה וכתובות אורח לכל שולחן דורשים את חבילת ההזמנות. החליפו חבילה כדי להפעיל.",
  pickupGuestTitle: "קישור אורח לאיסוף",
  pickupGuestHint:
    "שתפו או הדפיסו את הכתובת / QR לאורחים שמזמינים לאיסוף — לא לסשן שולחן.",
  pickupGuestUrlLabel: "כתובת איסוף",
  menuGuestTitle: "קישור תפריט לאורחים",
  menuGuestHint:
    "שתפו את קישור התפריט הציבורי — אורחים יכולים לעיין ולקרוא למלצר (בלי QR לשולחן).",
  menuGuestHintOrdering:
    "שתפו את קישור התפריט הציבורי — אורחים מעיינים, מזינים מספר שולחן, נרשמים ומזמינים (QR לשולחן עדיין עובד).",
  alertsBoardTitle: "לוח התראות",
  alertsBoardHint:
    "מסך צוות לקריאות מלצר — כולל תור איסוף כשהחבילה כוללת איסוף.",
  copyLink: "העתקת קישור",
  linkCopied: "הועתק",
  colNumber: "#",
  colSection: "אזור",
  colStatus: "סטטוס",
  colGuestUrl: "כתובת אורח",
  sections: {
    INSIDE: "פנים",
    OUTSIDE: "חוץ",
    TERRACE: "מרפסת",
  },
  statuses: {
    FREE: "פנוי",
    ACTIVE: "פעיל",
    BILL_REQUESTED: "חשבון התבקש",
    DISABLED: "מושבת",
  },
  packageTitle: "חבילת לקוח",
  packageHint: "תפריט דיגיטלי תמיד כלול. בחרו אילו תוספות המקום מקבל.",
  packageMenuOnly: "תפריט בלבד",
  packageMenuAlerts: "תפריט + מערכת התראות",
  packageMenuAlertsPickup: "תפריט + התראות + איסוף",
  packageMenuOrdering: "תפריט + הזמנות",
  packageMenuOnlyDesc: "קישור תפריט ציבורי לאורחים",
  packageMenuAlertsDesc: "קישור תפריט ציבורי + התראות קריאת מלצר (בלי QR לשולחן)",
  packageMenuAlertsPickupDesc: "קישור איסוף עם תפריט בפנים + התראות מלצר",
  packageMenuOrderingDesc:
    "קישור תפריט ציבורי (הזנת מספר שולחן) + QR אופציונלי לשולחן להזמנה מלאה",
  featureDigitalMenu: "תפריט דיגיטלי",
  featureAlerts: "התראות מלצר / קריאה למלצר",
  featureOrdering: "הזמנות משולחן",
  featurePickup: "מערכת איסוף",
  featureAlwaysOn: "תמיד פעיל",
  packageSaved: "החבילה נשמרה",
  packageSaveError: "לא ניתן לשמור את החבילה",
};

const adminRu: AdminMessages = {
  title: "Админ",
  language: "Язык",
  navDashboard: "Панель",
  navMenu: "Меню",
  navTables: "Столы",
  navLinks: "Ссылки гостей",
  navPackage: "Пакет",
  linkKitchen: "Кухня",
  linkWaiter: "Официант",
  linkPickup: "Очередь самовывоза",
  linkAlerts: "Доска оповещений",
  venueFallback: "Заведение",
  revenueToday: "Выручка сегодня",
  ordersToday: "Заказы сегодня",
  openTables: "Открытые столы",
  avgCheck: "Средний чек",
  menuItemsLive: "Позиции меню",
  pickupWaiting: "Самовывоз ожидает",
  pickupReady: "Самовывоз готов",
  liveFeed: "Лента",
  pickupFeed: "Недавний самовывоз",
  noOrders: "Пока нет заказов сегодня",
  noPickupTickets: "Пока нет билетов самовывоза",
  menuOnlyDashHint:
    "Заведение на пакете «Только меню» — управляйте цифровым меню ниже. Заказы со столов и самовывоз требуют апгрейда пакета.",
  manageMenuCta: "Открыть меню",
  openPackageCta: "Сменить пакет",
  menuTitle: "Меню",
  editLocale: "Язык правки",
  nameLabel: "Название",
  descriptionLabel: "Описание",
  descriptionPlaceholder: "Описание блюда…",
  priceLabel: "Цена (₪)",
  availableOnMenu: "Доступно в меню",
  imageLabel: "Фото блюда",
  imageHint: "JPEG, PNG, WebP или GIF · до 4MB",
  imageChoose: "Выбрать фото",
  imageRemove: "Удалить фото",
  imageUploading: "Загрузка…",
  save: "Сохранить",
  cancel: "Отмена",
  on: "Вкл",
  off: "Выкл",
  edit: "Изменить",
  hideItem: "Скрыть",
  showItem: "Показать",
  hideAll: "Скрыть все",
  showAll: "Показать все",
  hiddenBadge: "Скрыто",
  addCategory: "Добавить категорию",
  addCategoryTitle: "Новая категория",
  createCategory: "Создать категорию",
  categoryNamePlaceholder: "напр. Десерты",
  categoryLabel: "Категория",
  editCategory: "Переименовать",
  translateCategory: "Перевести",
  addSubcategory: "Добавить подкатегорию",
  addSubcategoryTitle: "Новая подкатегория",
  deleteCategory: "Удалить категорию",
  deleteCategoryConfirm: "Удалить категорию и пустые блюда/подкатегории?",
  deleteCategoryBlocked:
    "В категории есть блюда, которые уже заказывали — удалить нельзя. Скройте их.",
  subcategoryBadge: "Под",
  addItem: "Добавить блюдо",
  addItemTitle: "Новое блюдо",
  createItem: "Создать",
  routeLabel: "Кухонный маршрут",
  routes: {
    MAIN_KITCHEN: "Основная кухня",
    MEAT_KITCHEN: "Мясная кухня",
    BAR: "Бар",
    HOOKAH: "Кальян",
  },
  removeItem: "Удалить",
  removeItemConfirm: "Удалить это блюдо из меню?",
  removeItemBlocked: "Блюдо уже заказывали — удалить нельзя. Выключите его.",
  extrasTitle: "Добавки",
  extrasHint: "Опции, которые гость может отметить (название + цена).",
  addExtra: "Добавить опцию",
  extraNamePlaceholder: "напр. сыр",
  extraPricePlaceholder: "Цена",
  removeExtra: "Удалить",
  tablesTitle: "Столы и QR",
  tablesHint: "Прошейте NTAG215 гостевым URL. Распечатайте тот же URL как QR.",
  orderingRequiredTitle: "Заказы со столов не в этом пакете",
  orderingRequiredBody:
    "Сессии столов, статус зала и гостевые URL по столам требуют пакета Ordering. Смените пакет, чтобы включить.",
  pickupGuestTitle: "Ссылка гостя на самовывоз",
  pickupGuestHint:
    "Поделитесь или распечатайте этот URL / QR для гостей с самовывозом — не для сессий за столом.",
  pickupGuestUrlLabel: "URL самовывоза",
  menuGuestTitle: "Ссылка на меню для гостей",
  menuGuestHint:
    "Поделитесь публичной ссылкой на меню — гости могут смотреть меню и вызвать официанта (без QR стола).",
  menuGuestHintOrdering:
    "Поделитесь публичной ссылкой на меню — гости смотрят меню, вводят номер стола, регистрируются и заказывают (QR стола по-прежнему работает).",
  alertsBoardTitle: "Доска оповещений",
  alertsBoardHint:
    "Экран персонала для вызова официанта — включает очередь самовывоза при соответствующем пакете.",
  copyLink: "Копировать",
  linkCopied: "Скопировано",
  colNumber: "#",
  colSection: "Зона",
  colStatus: "Статус",
  colGuestUrl: "Гостевой URL",
  sections: {
    INSIDE: "Внутри",
    OUTSIDE: "Снаружи",
    TERRACE: "Терраса",
  },
  statuses: {
    FREE: "Свободен",
    ACTIVE: "Активен",
    BILL_REQUESTED: "Счёт запрошен",
    DISABLED: "Отключён",
  },
  packageTitle: "Пакет клиента",
  packageHint:
    "Цифровое меню всегда включено. Выберите доп. функции для заведения.",
  packageMenuOnly: "Только меню",
  packageMenuAlerts: "Меню + система оповещений",
  packageMenuAlertsPickup: "Меню + оповещения + самовывоз",
  packageMenuOrdering: "Меню + заказы",
  packageMenuOnlyDesc: "Публичная ссылка на меню для гостей",
  packageMenuAlertsDesc: "Публичное меню + вызов официанта (без QR стола)",
  packageMenuAlertsPickupDesc: "Ссылка самовывоза с меню внутри + оповещения",
  packageMenuOrderingDesc:
    "Публичная ссылка на меню (номер стола) + опциональный QR стола для полного заказа",
  featureDigitalMenu: "Цифровое меню",
  featureAlerts: "Оповещения / вызов официанта",
  featureOrdering: "Заказ со стола",
  featurePickup: "Система самовывоза",
  featureAlwaysOn: "Всегда вкл.",
  packageSaved: "Пакет сохранён",
  packageSaveError: "Не удалось сохранить пакет",
};

export const adminMessages: Record<Locale, AdminMessages> = {
  en: adminEn,
  ar: adminAr,
  he: adminHe,
  ru: adminRu,
};

export type PickupMessages = {
  title: string;
  floor: string;
  language: string;
  hint: string;
  loading: string;
  assistanceSection: string;
  emptyAssistance: string;
  assistanceAcknowledge: string;
  assistanceDone: string;
  assistanceAcknowledged: string;
  waitingSection: string;
  readySection: string;
  emptyWaiting: string;
  emptyReady: string;
  markReady: string;
  markPickedUp: string;
  cancel: string;
  ping: string;
  pingSent: string;
  readyBadge: string;
  callWaiterBadge: string;
  callWaiterTitle: string;
  callWaiterName: string;
  callWaiterOrderRef: string;
  callWaiterComment: string;
  callWaiterDismiss: string;
  soundEnable: string;
  tapDismiss: string;
  refresh: string;
  lock: string;
  liveSuffix: string;
  linkKitchen: string;
  linkWaiter: string;
  linkAdmin: string;
  featureDisabledTitle: string;
  featureDisabledBody: string;
};

const pickupEn: PickupMessages = {
  title: "Pickup queue",
  floor: "My Restaurant · Pickup",
  language: "Language",
  hint: "Mark guest orders ready when the counter can hand them off.",
  loading: "Loading…",
  assistanceSection: "Waiter calls",
  emptyAssistance: "No waiter calls",
  assistanceAcknowledge: "Acknowledge",
  assistanceDone: "Done",
  assistanceAcknowledged: "Acknowledged",
  waitingSection: "Waiting orders",
  readySection: "Ready For Pickup Orders",
  emptyWaiting: "No guests waiting",
  emptyReady: "Nothing ready yet",
  markReady: "Mark ready",
  markPickedUp: "Picked up",
  cancel: "Cancel",
  ping: "Ping",
  pingSent: "Pinged",
  readyBadge: "Ready",
  callWaiterBadge: "Guest needs help",
  callWaiterTitle: "Call a waiter",
  callWaiterName: "Guest",
  callWaiterOrderRef: "Order / table",
  callWaiterComment: "Comment",
  callWaiterDismiss: "Got it",
  soundEnable: "Tap here to enable call-waiter sound + alerts",
  tapDismiss: "Tap to dismiss",
  refresh: "Refresh now",
  lock: "Lock",
  liveSuffix: "live alerts + auto-refresh",
  linkKitchen: "Kitchen",
  linkWaiter: "Waiter",
  linkAdmin: "Admin",
  featureDisabledTitle: "Pickup not in your package",
  featureDisabledBody: "Pickup is turned off. Enable it under Admin → Package.",
};

const pickupAr: PickupMessages = {
  title: "طابور الاستلام",
  floor: "مطعمي · الاستلام",
  language: "اللغة",
  hint: "علّم الطلبات جاهزة عندما يمكن تسليمها من الكاونتر.",
  loading: "جاري التحميل…",
  assistanceSection: "استدعاءات النادل",
  emptyAssistance: "لا توجد استدعاءات",
  assistanceAcknowledge: "تم الاستلام",
  assistanceDone: "تم",
  assistanceAcknowledged: "مُستلم",
  waitingSection: "طلبات بالانتظار",
  readySection: "طلبات جاهزة للاستلام",
  emptyWaiting: "لا يوجد ضيوف بالانتظار",
  emptyReady: "لا شيء جاهز بعد",
  markReady: "جاهز",
  markPickedUp: "تم الاستلام",
  cancel: "إلغاء",
  ping: "تنبيه",
  pingSent: "تم التنبيه",
  readyBadge: "جاهز",
  callWaiterBadge: "الضيف يحتاج مساعدة",
  callWaiterTitle: "استدعاء نادل",
  callWaiterName: "الضيف",
  callWaiterOrderRef: "طلب / طاولة",
  callWaiterComment: "ملاحظة",
  callWaiterDismiss: "تم",
  soundEnable: "اضغط هنا لتفعيل صوت استدعاء النادل والتنبيهات",
  tapDismiss: "اضغط للإغلاق",
  refresh: "تحديث الآن",
  lock: "قفل",
  liveSuffix: "تنبيهات مباشرة وتحديث تلقائي",
  linkKitchen: "المطبخ",
  linkWaiter: "النادل",
  linkAdmin: "الإدارة",
  featureDisabledTitle: "الاستلام غير مفعّل في باقتك",
  featureDisabledBody: "نظام الاستلام متوقف. فعّله من الإدارة ← الباقة.",
};

const pickupHe: PickupMessages = {
  title: "תור איסוף",
  floor: "המסעדה שלי · איסוף",
  language: "שפה",
  hint: "סמנו הזמנות כמוכנות כשאפשר למסור בדלפק.",
  loading: "טוען…",
  assistanceSection: "קריאות למלצר",
  emptyAssistance: "אין קריאות",
  assistanceAcknowledge: "אישור",
  assistanceDone: "בוצע",
  assistanceAcknowledged: "אושר",
  waitingSection: "הזמנות ממתינות",
  readySection: "הזמנות מוכנות לאיסוף",
  emptyWaiting: "אין אורחים ממתינים",
  emptyReady: "עדיין אין מוכנים",
  markReady: "סמן כמוכן",
  markPickedUp: "נאסף",
  cancel: "ביטול",
  ping: "פינג",
  pingSent: "נשלח",
  readyBadge: "מוכן",
  callWaiterBadge: "האורח צריך עזרה",
  callWaiterTitle: "קריאה למלצר",
  callWaiterName: "אורח",
  callWaiterOrderRef: "הזמנה / שולחן",
  callWaiterComment: "הערה",
  callWaiterDismiss: "הבנתי",
  soundEnable: "לחצו כאן להפעלת צליל קריאת מלצר והתראות",
  tapDismiss: "לחצו לסגירה",
  refresh: "רענון עכשיו",
  lock: "נעילה",
  liveSuffix: "התראות חיות ורענון אוטומטי",
  linkKitchen: "מטבח",
  linkWaiter: "מלצר",
  linkAdmin: "ניהול",
  featureDisabledTitle: "איסוף אינו כלול בחבילה",
  featureDisabledBody: "איסוף כבוי. הפעילו תחת ניהול ← חבילה.",
};

const pickupRu: PickupMessages = {
  title: "Очередь самовывоза",
  floor: "Мой ресторан · Самовывоз",
  language: "Язык",
  hint: "Отметьте заказ готовым, когда его можно выдать на стойке.",
  loading: "Загрузка…",
  assistanceSection: "Вызовы официанта",
  emptyAssistance: "Нет вызовов",
  assistanceAcknowledge: "Принято",
  assistanceDone: "Готово",
  assistanceAcknowledged: "Принято",
  waitingSection: "Ожидающие заказы",
  readySection: "Заказы готовые к выдаче",
  emptyWaiting: "Нет ожидающих гостей",
  emptyReady: "Пока ничего не готово",
  markReady: "Готово",
  markPickedUp: "Забрали",
  cancel: "Отмена",
  ping: "Пинг",
  pingSent: "Отправлено",
  readyBadge: "Готово",
  callWaiterBadge: "Гостю нужна помощь",
  callWaiterTitle: "Вызов официанта",
  callWaiterName: "Гость",
  callWaiterOrderRef: "Заказ / стол",
  callWaiterComment: "Комментарий",
  callWaiterDismiss: "Понятно",
  soundEnable: "Нажмите, чтобы включить звук вызова официанта и оповещения",
  tapDismiss: "Нажмите, чтобы закрыть",
  refresh: "Обновить",
  lock: "Заблокировать",
  liveSuffix: "живые оповещения и автообновление",
  linkKitchen: "Кухня",
  linkWaiter: "Официант",
  linkAdmin: "Админ",
  featureDisabledTitle: "Самовывоз не входит в пакет",
  featureDisabledBody: "Самовывоз выключен. Включите в Админ → Пакет.",
};

export const pickupMessages: Record<Locale, PickupMessages> = {
  en: pickupEn,
  ar: pickupAr,
  he: pickupHe,
  ru: pickupRu,
};

export type StaffGateMessages = {
  badge: string;
  title: string;
  hint: string;
  password: string;
  unlock: string;
  wrongPassword: string;
  language: string;
};

export const staffGateMessages: Record<Locale, StaffGateMessages> = {
  en: {
    badge: "Staff",
    title: "Staff login",
    hint: "Enter the staff password to open this board.",
    password: "Staff password",
    unlock: "Unlock",
    wrongPassword: "Wrong staff password",
    language: "Language",
  },
  ar: {
    badge: "الموظفون",
    title: "دخول الموظفين",
    hint: "أدخل كلمة مرور الموظفين لفتح هذه الشاشة.",
    password: "كلمة مرور الموظفين",
    unlock: "فتح",
    wrongPassword: "كلمة مرور الموظفين غير صحيحة",
    language: "اللغة",
  },
  he: {
    badge: "צוות",
    title: "כניסת צוות",
    hint: "הזינו את סיסמת הצוות כדי לפתוח את המסך.",
    password: "סיסמת צוות",
    unlock: "פתיחה",
    wrongPassword: "סיסמת צוות שגויה",
    language: "שפה",
  },
  ru: {
    badge: "Персонал",
    title: "Вход для персонала",
    hint: "Введите пароль персонала, чтобы открыть этот экран.",
    password: "Пароль персонала",
    unlock: "Открыть",
    wrongPassword: "Неверный пароль персонала",
    language: "Язык",
  },
};

export function getStoredStaffLocale(): Locale {
  try {
    const v = localStorage.getItem(STAFF_LOCALE_KEY);
    if (v && locales.includes(v as Locale)) return v as Locale;
  } catch {
    /* ignore */
  }
  return "ar";
}

export function setStoredStaffLocale(locale: Locale) {
  try {
    localStorage.setItem(STAFF_LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}
