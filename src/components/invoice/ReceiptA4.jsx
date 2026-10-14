import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import CompanyLogo from '../../assets/logo_transparent.png';
import AppLogo from '../../assets/logo_blanc_shop.jpg';

// Copie conforme de la facture A4 de l'application agence
// (Agence_partenaire/agence-partenaire/src/components/Receipts/ReceiptA4.jsx) :
// le client télécharge exactement le même document que celui remis au guichet.
// Toute évolution doit être reportée dans les deux applications.

const ReceiptA4 = React.forwardRef(({ expedition, agency }, ref) => {
    if (!expedition) return null;


    // Récupérer tous les frais
    const montantExpedition = parseFloat(expedition.montant_expedition) || 0;
    const fraisAnnexes = parseFloat(expedition.frais_annexes) || 0;
    const fraisEmballage = parseFloat(expedition.frais_emballage) || 0;
    const fraisEnlevement = parseFloat(expedition.frais_enlevement_domicile) || 0;
    const fraisLivraison = parseFloat(expedition.frais_livraison_domicile) || 0;
    const fraisRetard = parseFloat(expedition.frais_retard_retrait) || 0;
    
    // Calculer le total
    const totalAPayer = montantExpedition + fraisAnnexes + fraisEmballage + fraisEnlevement + fraisLivraison + fraisRetard;

    // Vérifier si la destination est la France
    const paysDestination = expedition.destinataire?.pays || expedition.destinataire_pays || expedition.pays_destination || '';
    const isFrance = paysDestination.toLowerCase().includes('france');
    
    // Taux de conversion CFA vers EUR (1 EUR = 655.957 CFA)
    const tauxConversion = 655.957;
    const totalEnEuros = totalAPayer / tauxConversion;

    const date = expedition.created_at ? new Date(expedition.created_at) : new Date();
    // Utiliser la référence existante comme numéro de facture
    const invoiceNumber = expedition.reference || `REF-${expedition.id || '0000'}`;
    
    // Extraction intelligente du logo et des informations de l'agence
    const logoSrc = agency?.logo || CompanyLogo;
    
    // Extraction des informations d'agence avec plusieurs fallbacks
    const agencyName = agency?.nom_agence || agency?.name || agency?.nom || 'VOTRE AGENCE';
    const agencyAddress = agency?.adresse || agency?.address || '';
    const agencyCity = agency?.ville || agency?.city || '';
    const agencyCountry = agency?.pays || agency?.country || '';
    const agencyPhone = agency?.telephone || agency?.telephone_agence || agency?.phone || agency?.agence?.telephone || 'Non renseigné';
    const agencyEmail = agency?.email || '';
    
    
    const isPaid = expedition.statut_paiement === 'paye';

    return (
        <div ref={ref} className="p-10 bg-white text-slate-900 font-sans relative overflow-hidden" style={{ width: '210mm', minHeight: '297mm' }}>
            {/* Content Container */}
            <div className="relative h-full flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <img src={logoSrc} alt="Logo" className="h-16 object-contain" />
                        </div>
                        <h1 className="text-2xl font-bold uppercase tracking-tight mb-2">
                            {agencyName}
                        </h1>
                        {agencyAddress && (
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                📍 {agencyAddress}
                            </p>
                        )}
                        {(agencyCity || agencyCountry) && (
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                                {agencyCity}{agencyCity && agencyCountry ? ', ' : ''}{agencyCountry}
                            </p>
                        )}
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                            📞 {agencyPhone}
                        </p>
                        {agencyEmail && (
                            <p className="text-xs font-bold text-slate-600 tracking-wide">
                                ✉️ {agencyEmail}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex flex-col items-end">
                        {/* Logo de l'application */}
                        <div className="mb-3">
                            <img src={AppLogo} alt="Tour Shop" className="h-16 w-auto object-contain rounded-lg shadow-sm" />
                        </div>
                        
                        {/* <div className="bg-slate-900 text-white px-4 py-2 mb-2 inline-block rounded-tl-xl rounded-br-xl shadow-md">
                            <h2 className="text-lg font-bold uppercase tracking-wide">FACTURE</h2>
                        </div> */}
                        <p className="text-sm font-bold uppercase tracking-wide">N° {invoiceNumber}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">Éditée le {format(date, 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
                        {expedition.reference && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wide">Réf: {expedition.reference}</p>}
                        {expedition.code_suivi_expedition && (
                            <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 mt-1 uppercase tracking-wide inline-block">
                                Suivi: {expedition.code_suivi_expedition}
                            </p>
                        )}

                        {/* Payment Status Stamp */}
                        <div className={`mt-3 px-3 py-1 border-2 inline-block transform -rotate-6 ${isPaid ? 'border-emerald-600 text-emerald-600' : 'border-amber-600 text-amber-600'}`}>
                            <span className="text-base font-bold uppercase tracking-wide leading-none">
                                {isPaid ? 'PAYÉ' : 'PAIEMENT À L\'ARRIVÉE'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Partners Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl shadow-sm">
                        <div className="flex items-center mb-3 border-b border-slate-200 pb-2">
                            <div className="w-2 h-4 bg-indigo-600 mr-2 rounded-sm"></div>
                            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">EXPÉDITEUR / FACTURÉ À</h3>
                        </div>
                        <p className="text-sm font-bold uppercase tracking-tight text-slate-800">{expedition.expediteur?.nom_prenom || expedition.expediteur_nom_prenom}</p>
                        <p className="text-xs font-bold text-slate-600 mt-1">{expedition.expediteur?.telephone || expedition.expediteur_telephone}</p>
                        <p className="text-xs font-medium text-slate-500 mt-2">{expedition.expediteur?.adresse || expedition.expediteur_adresse}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{expedition.expediteur?.ville || expedition.expediteur_ville}, {expedition.expediteur?.pays || expedition.expediteur_pays || expedition.pays_depart}</p>
                    </div>
                    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl shadow-sm">
                        <div className="flex items-center mb-3 border-b border-slate-200 pb-2">
                            <div className="w-2 h-4 bg-blue-600 mr-2 rounded-sm"></div>
                            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">DESTINATAIRE LIEE</h3>
                        </div>
                        <p className="text-sm font-bold uppercase tracking-tight text-slate-800">{expedition.destinataire?.nom_prenom || expedition.destinataire_nom_prenom}</p>
                        <p className="text-xs font-bold text-slate-600 mt-1">{expedition.destinataire?.telephone || expedition.destinataire_telephone}</p>
                        <p className="text-xs font-medium text-slate-500 mt-2">{expedition.destinataire?.adresse || expedition.destinataire_adresse}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                            {expedition.destinataire?.ville || expedition.destinataire_ville}
                            {(expedition.destinataire?.code_postal || expedition.destinataire_code_postal) && 
                                <span className="ml-1 text-indigo-600">({expedition.destinataire?.code_postal || expedition.destinataire_code_postal})</span>
                            }
                            , {expedition.destinataire?.pays || expedition.destinataire_pays || expedition.pays_destination}
                        </p>
                    </div>
                </div>

                {/* Shipment Details Table (Modernized) */}
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-3">
                        DÉTAILS DES PRESTATIONS
                        <div className="flex-1 h-[2px] bg-slate-100"></div>
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 text-slate-600 text-[10px] font-semibold uppercase tracking-wide border-b border-slate-200">
                                    <th className="px-4 py-2.5">Code</th>
                                    <th className="px-4 py-2.5">Désignation</th>
                                    <th className="px-4 py-2.5 text-center">Qté</th>
                                    <th className="px-4 py-2.5 text-center">Poids (kg)</th>
                                    <th className="px-4 py-2.5 text-center">Dimensions</th>
                                    <th className="px-4 py-2.5 text-right">Montant (CFA)</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs font-bold">
                                {expedition.colis?.map((c, i) => (
                                    <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="font-mono text-[10px] text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 inline-block">
                                                {c.code_colis || `C-${i + 1}`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="text-slate-900 uppercase tracking-tight">{c.designation || 'Colis'}</p>
                                            {c.category?.nom && <p className="text-[9px] text-indigo-600 uppercase tracking-wide mt-0.5">{c.category.nom}</p>}
                                            {c.articles?.length > 0 && (
                                                <p className="text-[10px] text-slate-400 font-medium italic mt-0.5 line-clamp-1">({c.articles.map(a => a.designation || a).join(', ')})</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-slate-500">1</td>
                                        <td className="px-4 py-2.5 text-center font-mono text-slate-700">{parseFloat(c.poids).toFixed(2)}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-500 text-[10px] tracking-tighter">
                                            {c.longueur || 0}x{c.largeur || 0}x{c.hauteur || 0} cm
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-slate-900">
                                            {parseFloat(c.montant_colis_total || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="flex justify-end mb-6">
                    <div className="w-1/2 rounded-xl border border-slate-200 p-4 bg-slate-50/50 shadow-sm relative overflow-hidden">
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 opacity-50 z-0"></div>

                        <div className="relative z-10 space-y-2.5">
                            {/* Montant d'expédition */}
                            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                <span className="uppercase tracking-wide">Montant d'expédition</span>
                                <span className="font-mono">{montantExpedition.toLocaleString()} CFA</span>
                            </div>

                            {/* Frais annexes */}
                            {fraisAnnexes > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span className="uppercase tracking-wide">Frais annexes</span>
                                    <span className="font-mono">{fraisAnnexes.toLocaleString()} CFA</span>
                                </div>
                            )}

                            {/* Frais d'emballage */}
                            {fraisEmballage > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span className="uppercase tracking-wide">Frais d'emballage</span>
                                    <span className="font-mono">{fraisEmballage.toLocaleString()} CFA</span>
                                </div>
                            )}

                            {/* Frais enlèvement domicile */}
                            {fraisEnlevement > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span className="uppercase tracking-wide">Frais enlèvement domicile</span>
                                    <span className="font-mono">{fraisEnlevement.toLocaleString()} CFA</span>
                                </div>
                            )}

                            {/* Frais livraison domicile */}
                            {fraisLivraison > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span className="uppercase tracking-wide">Frais livraison domicile</span>
                                    <span className="font-mono">{fraisLivraison.toLocaleString()} CFA</span>
                                </div>
                            )}

                            {/* Frais retard retrait */}
                            {fraisRetard > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span className="uppercase tracking-wide">Frais retard retrait</span>
                                    <span className="font-mono">{fraisRetard.toLocaleString()} CFA</span>
                                </div>
                            )}

                            <div className="h-px bg-slate-200 my-3"></div>

                            <div className="flex justify-between items-end">
                                <span className="text-sm font-bold uppercase tracking-wide text-slate-900">Total Net À Payer</span>
                                <div className="text-right">
                                    <span className="text-xl font-bold font-mono text-indigo-700 leading-none block">
                                        {totalAPayer.toLocaleString()} CFA
                                    </span>
                                    {isFrance && (
                                        <span className="text-sm font-bold font-mono text-blue-600 leading-none block mt-1.5">
                                            ≈ {totalEnEuros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                                        </span>
                                    )}
                                    {isPaid && expedition.mode_paiement && (
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide block mt-1">
                                            Réglé par {expedition.mode_paiement}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 pt-4 border-t-2 border-slate-900 break-inside-avoid">
                    <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Conditions Générales</h4>
                    <p className="text-[8px] text-slate-400 leading-relaxed font-medium">
                        Les marchandises sont transportées aux risques et périls de l'expéditeur sauf déclaration de valeur. Toute réclamation doit être faite à la réception du colis. Les délais de livraison sont donnés à titre indicatif et ne constituent pas un engagement ferme. En cas de perte ou d'avarie, notre responsabilité est strictement limitée à la valeur déclarée ou au barème en vigueur. La signature du bordereau de remise vaut acceptation pleine et entière de nos conditions générales de transport.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default ReceiptA4;
