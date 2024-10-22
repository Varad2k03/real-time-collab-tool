import { useCallback, useEffect, useState } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { io } from "socket.io-client"
import { useParams } from "react-router-dom"
import html2pdf from "html2pdf.js"
import { Packer, Document, Paragraph } from "docx"
import { saveAs } from "file-saver"

const SAVE_INTERVAL_MS = 2000
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
  // Add placeholders for the custom buttons
  [{ 'custom-pdf': 'PDF' }, { 'custom-docx': 'DOCX' }]
]

export default function TextEditor() {
  const { id: documentId } = useParams()
  const [socket, setSocket] = useState()
  const [quill, setQuill] = useState()

  useEffect(() => {
    const s = io("http://localhost:3001")
    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [])

  useEffect(() => {
    if (socket == null || quill == null) return

    socket.once("load-document", (document) => {
      quill.setContents(document)
      quill.enable()
    })

    socket.emit("get-document", documentId)
  }, [socket, quill, documentId])

  useEffect(() => {
    if (socket == null || quill == null) return

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents())
    }, SAVE_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [socket, quill])

  useEffect(() => {
    if (socket == null || quill == null) return

    const handler = (delta) => {
      quill.updateContents(delta)
    }
    socket.on("receive-changes", handler)

    return () => {
      socket.off("receive-changes", handler)
    }
  }, [socket, quill])

  useEffect(() => {
    if (socket == null || quill == null) return

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return
      socket.emit("send-changes", delta)
    }
    quill.on("text-change", handler)

    return () => {
      quill.off("text-change", handler)
    }
  }, [socket, quill])

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return

    wrapper.innerHTML = ""
    const editor = document.createElement("div")
    wrapper.append(editor)
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    })
    q.disable()
    q.setText("Loading...")
    setQuill(q)

    // Add event listeners for the custom buttons after Quill is initialized
    const pdfButton = document.querySelector(".ql-custom-pdf")
    const docxButton = document.querySelector(".ql-custom-docx")

    if (pdfButton) {
      pdfButton.addEventListener("click", downloadAsPDF)
    }

    if (docxButton) {
      docxButton.addEventListener("click", downloadAsDocx)
    }
  }, [])

  // Function to download content as PDF
  const downloadAsPDF = () => {
    const content = document.querySelector(".ql-editor")
    const opt = {
      margin: 1,
      filename: "document.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    }
    html2pdf().from(content).set(opt).save()
  }

  // Function to download content as DOCX
  const downloadAsDocx = () => {
    const content = quill.getText()
    const doc = new Document({
      sections: [
        {
          children: [new Paragraph(content)],
        },
      ],
    })

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, "document.docx")
    })
  }
  return <div className="container" ref={wrapperRef}></div>
}
