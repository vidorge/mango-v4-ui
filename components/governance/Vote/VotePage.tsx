import dynamic from 'next/dynamic'
import GovernancePageWrapper from '../GovernancePageWrapper'

const Vote = dynamic(() => import('./Vote'))

const ListTokenPage = () => {
  return (
    <div className="p-8 pb-20 md:pb-16 lg:p-10">
      <GovernancePageWrapper>
        <Vote />
      </GovernancePageWrapper>
    </div>
  )
}
export default ListTokenPage
