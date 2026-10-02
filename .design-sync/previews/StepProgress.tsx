import { StepProgress } from 'client-app';

const labels = ['Trajet', 'Colis', 'Expéditeur', 'Destinataire', 'Récapitulatif'];

export const Simple = () => (
  <div className="max-w-md">
    <StepProgress step={2} total={5} labels={labels} />
  </div>
);

export const Cliquable = () => (
  <div className="max-w-md">
    <StepProgress step={3} total={5} labels={labels} onStepClick={() => {}} maxStepReached={4} />
  </div>
);

export const Debut = () => (
  <div className="max-w-md">
    <StepProgress step={1} total={4} labels={['Mode', 'Destination', 'Colis', 'Paiement']} />
  </div>
);
