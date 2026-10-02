// Design-sync entry: the client-app components exported to Claude Design as window.TousShopClient.
// The app has no library build, so this barrel is the "package" the converter bundles.
export { DsProvider } from './DsProvider.jsx';

export { default as BottomSheet } from '../src/components/common/BottomSheet.jsx';
export { default as BottomNav } from '../src/components/common/BottomNav.jsx';
export { default as TopBar } from '../src/components/common/TopBar.jsx';
export { default as EmptyState } from '../src/components/common/EmptyState.jsx';
export { default as LoadingSpinner } from '../src/components/common/LoadingSpinner.jsx';

export { default as StepProgress } from '../src/components/expedition/StepProgress.jsx';
export { default as ContactFields } from '../src/components/expedition/ContactFields.jsx';
export { default as DestinationCountrySheet } from '../src/components/expedition/DestinationCountrySheet.jsx';
export { default as ProductSelectSheet } from '../src/components/expedition/ProductSelectSheet.jsx';

export { default as SegmentedTabs } from '../src/components/marketplace/SegmentedTabs.jsx';
export { default as StatusBadge } from '../src/components/marketplace/StatusBadge.jsx';
export { default as OrderTimeline } from '../src/components/marketplace/OrderTimeline.jsx';
export { PersonRow, OrderItemsCard, PaymentInfoCard, DeliveryInfoCard, DeliveryCodeCard } from '../src/components/marketplace/OrderParts.jsx';
export { default as ImageGallery } from '../src/components/marketplace/ImageGallery.jsx';
export { PhotoPicker, ProofPicker } from '../src/components/marketplace/FilePickers.jsx';
export { default as AnimatedNumber } from '../src/components/marketplace/AnimatedNumber.jsx';

// Status dictionaries StatusBadge takes as its `map` prop.
export { ANNONCE_STATUTS, COMMANDE_STATUTS, LIVRAISON_STATUTS, ECHEANCE_STATUTS, PAIEMENT_ABONNEMENT_STATUTS } from '../src/utils/marketplace.js';

// The lucide icons the app itself uses (icon props take these).
export { AlertTriangle, ArrowDownLeft, ArrowRight, Banknote, BellRing, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardList, Clock, Copy, CreditCard, Download, ExternalLink, Eye, EyeOff, FileText, Gift, Globe2, Heart, Home, Hourglass, ImageOff, ImagePlus, Images, Info, KeyRound, Landmark, Lightbulb, Loader2, Lock, LogIn, Mail, MapPin, MapPinned, MessageCircle, Package, PackageCheck, PackagePlus, PackageSearch, PackageX, Pencil, Phone, Plus, Receipt, RefreshCw, Rocket, Save, Search, Share, Share2, ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Store, Tag, Trash2, TrendingUp, Truck, User, Users, Wallet, Wrench, X, ZoomIn } from 'lucide-react';

// framer-motion config from the bundle's own copy: MotionConfig for designs (e.g. reducedMotion),
// MotionGlobalConfig so static previews can skip entry animations (captures run before they finish).
export { MotionConfig, MotionGlobalConfig } from 'framer-motion';
