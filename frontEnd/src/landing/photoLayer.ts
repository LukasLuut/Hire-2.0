// Estado da foto que atravessa as cenas 04 e 05 (sharedPhoto.tsx): a 04 controla opacidade e crescimento,
// a 05 o escurecimento. Fica fora do componente para as duas cenas escreverem nele sem re-render.
import { motionValue } from "framer-motion";

export const photoLayer = { opacity: motionValue(0), scale: motionValue(0.72), dim: motionValue(0) };
