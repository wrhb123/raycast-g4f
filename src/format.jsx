import useGPT from "./api/gpt";

export default function Format(props) {
  return useGPT(props, {
    context: "Fix the formatting of the following text. ONLY return the modified text and nothing else.",
    useSelected: true,
    showFormText: "Text",
    allowPaste: true,
  });
}
