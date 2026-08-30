import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MapPinned, Check, AlertTriangle } from 'lucide-react';
import BottomSheet from '../common/BottomSheet';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { fetchAgencies } from '../../store/slices/agencySlice';

export default function AgencySelectSheet({ open, onClose, codePays, currentId, onSelect }) {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.agencies);

  useEffect(() => {
    if (open && codePays) dispatch(fetchAgencies({ code_pays: codePays }));
  }, [open, codePays, dispatch]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Agence de depart">
      {status === 'loading' && <LoadingSpinner label="Chargement des agences..." />}

      {status === 'error' && (
        <EmptyState
          icon={AlertTriangle}
          title="Impossible de charger les agences"
          description="Verifiez votre connexion puis reessayez."
          action={
            <button type="button" className="btn-primary" onClick={() => dispatch(fetchAgencies({ code_pays: codePays }))}>
              Reessayer
            </button>
          }
        />
      )}

      {status === 'idle' && items.length === 0 && (
        <EmptyState
          icon={MapPinned}
          title="Aucune agence disponible"
          description="Aucune agence active n'a ete trouvee pour ce pays."
        />
      )}

      {status === 'idle' && items.length > 0 && (
        <div className="max-h-[60dvh] divide-y divide-surface-100 overflow-y-auto rounded-xl border border-surface-100">
          {items.map((agency) => (
            <button
              key={agency.id}
              type="button"
              onClick={() => {
                onSelect(agency);
                onClose();
              }}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-50"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <MapPinned size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-surface-900">{agency.nom_agence}</p>
                <p className="truncate text-xs text-surface-500">
                  {[agency.adresse, agency.commune || agency.ville].filter(Boolean).join(', ')}
                </p>
              </div>
              {currentId === agency.id && <Check size={16} className="shrink-0 text-primary-600" />}
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
