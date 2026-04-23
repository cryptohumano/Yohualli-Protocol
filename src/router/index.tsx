import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Accounts from '@/pages/Accounts'
import AccountDetail from '@/pages/AccountDetail'
import CreateAccount from '@/pages/CreateAccount'
import ImportAccount from '@/pages/ImportAccount'
import Send from '@/pages/Send'
import Receive from '@/pages/Receive'
import Transactions from '@/pages/Transactions'
import TransactionDetail from '@/pages/TransactionDetail'
import Networks from '@/pages/Networks'
import Contacts from '@/pages/Contacts'
import Documents from '@/pages/Documents'
import DocumentDetail from '@/pages/DocumentDetail'
import DocumentEditor from '@/pages/DocumentEditor'
import FlightLogs from '@/pages/FlightLogs'
import MedicalRecords from '@/pages/MedicalRecords'
import Attestations from '@/pages/Attestations'
import MountainLogs from '@/pages/MountainLogs'
import MountainLogDetail from '@/pages/MountainLogDetail'
import Settings from '@/pages/Settings'
import Identity from '@/pages/Identity'
import ZkLab from '@/pages/ZkLab'

// Obtener el base path desde import.meta.env.BASE_URL (configurado por Vite)
// En desarrollo será '/', en producción será '/aura-pwa/' para GitHub Pages
const basename = import.meta.env.BASE_URL || '/'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'accounts',
        children: [
          {
            index: true,
            element: <Accounts />,
          },
          {
            path: 'create',
            element: <CreateAccount />,
          },
          {
            path: 'import',
            element: <ImportAccount />,
          },
          {
            path: ':address',
            element: <AccountDetail />,
          },
        ],
      },
      {
        path: 'send',
        element: <Send />,
      },
      {
        path: 'receive',
        element: <Receive />,
      },
      {
        path: 'transactions',
        children: [
          {
            index: true,
            element: <Transactions />,
          },
          {
            path: ':hash',
            element: <TransactionDetail />,
          },
        ],
      },
      {
        path: 'networks',
        element: <Networks />,
      },
      {
        path: 'contacts',
        element: <Contacts />,
      },
      {
        path: 'documents',
        children: [
          {
            index: true,
            element: <Documents />,
          },
          {
            path: 'new',
            element: <DocumentEditor />,
          },
          {
            path: ':documentId',
            element: <DocumentDetail />,
          },
          {
            path: ':documentId/edit',
            element: <DocumentEditor />,
          },
        ],
      },
      {
        path: 'flight-logs',
        element: <FlightLogs />,
      },
      {
        path: 'medical-records',
        element: <MedicalRecords />,
      },
      {
        path: 'attestations',
        element: <Attestations />,
      },
      {
        path: 'mountain-logs',
        children: [
          {
            index: true,
            element: <MountainLogs />,
          },
          {
            path: 'new',
            element: <MountainLogDetail />,
          },
          {
            path: ':logId',
            element: <MountainLogDetail />,
          },
        ],
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'identity',
        element: <Identity />,
      },
      {
        path: 'zk-lab',
        element: <ZkLab />,
      },
    ],
  },
], {
  basename: basename,
})

