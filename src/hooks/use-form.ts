import { useCallback, useReducer } from "react";
import type { Action, InputHandlerValue, Inputs, State } from "./types";

const formReducer = (state: State, action: Action) => {
  switch (action.type) {
    case "INPUT_CHANGE": {
      let isValid = true;
      for (const key in state.inputs) {
        if (!state.inputs[key]) continue;
        if (key === action.inputId) {
          isValid = isValid && (action.isValid || false);
        } else {
          isValid = isValid && state.inputs[key].isValid;
        }
      }
      return {
        ...state,
        inputs: {
          ...state.inputs,
          [action.inputId]: {
            value: action.value,
            isValid: action.isValid,
          },
        },
        isValid,
      };
    }
    case "SET_DATA":
      return {
        inputs: action.inputs,
        isValid: action.formIsValid,
      };
    default:
      return state;
  }
};

export const useForm = (
  initialInputs: Record<string, Inputs>,
  initialFormIsValid: boolean,
): [
  State,
  (id: string, value: InputHandlerValue, isValid: boolean) => void,
  (inputData: Record<string, Inputs>, formValidity: boolean) => void,
] => {
  const [formState, dispatch] = useReducer(formReducer, {
    inputs: initialInputs,
    isValid: initialFormIsValid,
  });

  const inputHandler = useCallback((id: string, value: InputHandlerValue, isValid: boolean) => {
    dispatch({
      type: "INPUT_CHANGE",
      value,
      isValid,
      inputId: id,
    });
  }, []);

  const setFormData = useCallback((inputData: Record<string, Inputs>, formValidity: boolean) => {
    dispatch({
      type: "SET_DATA",
      inputs: inputData,
      formIsValid: formValidity,
    });
  }, []);

  return [formState, inputHandler, setFormData] as const;
};
