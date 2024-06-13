import useGPT from "./api/gpt";

export default function AskAI(props) {
  return useGPT(props, { showFormText: "Prompt", allowUploadFiles: true });
}
