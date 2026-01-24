# Jubilee Protocol Frontend

## Setup

1.  **Install Dependencies**:
    ```bash
    cd frontend
    npm install
    ```

2.  **Configuration**:
    *   Open `config.ts` and set your `projectId` (from WalletConnect Cloud).
    *   Open `app/page.tsx` and replace `VAULT_ADDRESS` with the address from `../deployments.json`.

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## Stack
*   **Framework**: Next.js 14 (App Router)
*   **Connect**: RainbowKit + Wagmi v2
*   **SDK**: ThirdWeb v5 (Optional tools) + Viem
*   **Styling**: TailwindCSS

## Configuration
