import { ModalProps } from '../../types/modal'
import Modal from '../shared/Modal'
import CreateAccountForm from '@components/account/CreateAccountForm'
import { useRouter } from 'next/router'

const CreateAccountModal = ({ isOpen, onClose }: ModalProps) => {
  const router = useRouter()

  const handleClose = () => {
    if (router.asPath !== '/') {
      router.push('/')
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <CreateAccountForm customClose={handleClose} />
      </div>
    </Modal>
  )
}

export default CreateAccountModal
