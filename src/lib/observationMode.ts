/// <reference types="vite/client" />
export const UNIQUE_OBSERVATION_MODE =
  import.meta.env.VITE_UNIQUE_OBSERVATION_MODE === 'true';

export const isObservationMode = () => UNIQUE_OBSERVATION_MODE;
