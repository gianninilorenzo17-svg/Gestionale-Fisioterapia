import { CardImp } from './Riga'
import { RigaPassword } from './SchedaPassword'
import { RigheRecupero } from './SchedaRecupero'
import { RigaBlocco } from './SchedaBlocco'

// Le cose che si toccano di rado e che riguardano chi puo' entrare: password,
// come si rientra se la si dimentica, blocco dopo un po' di inattivita'.
export function SchedaSicurezza(): React.JSX.Element {
  return (
    <CardImp titolo="Accesso">
      <RigaPassword />
      <RigheRecupero />
      <RigaBlocco />
    </CardImp>
  )
}
