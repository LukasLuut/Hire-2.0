import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { requestChat } from "../../utils/chatEvents";

/**
 * /negotiation/:id (links de notificações e e-mails): abre a conversa na sala única do chat
 * e volta para a página em que a pessoa estava (ou para a Home, se entrou direto pelo link).
 */
export default function OpenChatRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const cid = Number(id);
    const back = (window.history.state?.idx ?? 0) > 0;
    if (back) navigate(-1);
    else navigate("/home", { replace: true });
    if (Number.isFinite(cid) && cid > 0) setTimeout(() => requestChat(cid), 0);
  }, [id, navigate]);
  return null;
}
