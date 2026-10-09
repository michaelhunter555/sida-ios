export type InputHandlerValue = string | number | boolean | undefined;

export interface Inputs {
  value: InputHandlerValue;
  isValid: boolean;
}

export interface State {
  inputs: Record<string, Inputs>;
  isValid: boolean;
}

export type Action =
  | {
      type: "INPUT_CHANGE";
      inputId: string;
      value: InputHandlerValue;
      isValid: boolean;
    }
  | {
      type: "SET_DATA";
      inputs: Record<string, Inputs>;
      formIsValid: boolean;
    };
