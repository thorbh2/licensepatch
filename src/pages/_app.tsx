import '@rainbow-me/rainbowkit/styles.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import NextApp, { type AppContext, type AppProps } from 'next/app';
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { defineChain } from 'viem';
import { loadOnchainSnapshot, OnchainProvider, type OnchainSnapshot } from '../lib/onchain';
import '../styles/globals.css';
import '../styles/onchain.css';
import '../styles/license-visual.css';

const bradbury = defineChain({
  id: 4221,
  name: 'GenLayer Bradbury',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-bradbury.genlayer.com'] } },
  blockExplorers: { default: { name: 'GenLayer Explorer', url: 'https://explorer-bradbury.genlayer.com' } },
});
const config = createConfig({
  chains: [bradbury],
  connectors: connectorsForWallets([
    { groupName: 'Browser wallets', wallets: [injectedWallet, metaMaskWallet] },
  ], { appName: "LicensePatch", projectId: 'licensepatch-bradbury' }),
  transports: { [bradbury.id]: http(bradbury.rpcUrls.default.http[0]) },
  ssr: true,
});
const queryClient = new QueryClient();
type Props = { initialOnchainSnapshot?: OnchainSnapshot };

export default function App({ Component, pageProps }: AppProps<Props>) {
  return <WagmiProvider config={config}><QueryClientProvider client={queryClient}>
    <RainbowKitProvider><OnchainProvider initialSnapshot={pageProps.initialOnchainSnapshot}>
      <Component {...pageProps} />
    </OnchainProvider></RainbowKitProvider>
  </QueryClientProvider></WagmiProvider>;
}
App.getInitialProps = async (context: AppContext) => {
  const props = await NextApp.getInitialProps(context);
  if (!context.ctx.req) return props;
  try {
    const initialOnchainSnapshot = await loadOnchainSnapshot(true);
    return { ...props, pageProps: { ...props.pageProps, initialOnchainSnapshot } };
  } catch { return props; }
};
