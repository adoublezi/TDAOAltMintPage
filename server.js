const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PRIVATE_KEY = '';
const contractAddress = '0x839cF9A9A9b95bAE13765fc421D45e8D87e1452e';
let holders = new Set(); // Store holders' addresses

const abi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            }
        ],
        "name": "safeMint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "ownerOf",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

async function getAllHolders() {
    const provider = new ethers.JsonRpcProvider('https://gnosis-rpc.publicnode.com');
    const contract = new ethers.Contract(contractAddress, abi, provider);
    holders.clear();
    let tokenId = 0;
    
    console.log('Fetching current NFT holders...');
    
    while (true) {
        try {
            const owner = await contract.ownerOf(tokenId);
            holders.add(owner.toLowerCase());
            console.log(`Token ${tokenId}: ${owner}`);
            tokenId++;
        } catch (error) {
            console.log(`Finished scanning at token ${tokenId}`);
            console.log(`Total unique holders: ${holders.size}`);
            break;
        }
    }
}

async function mintNFT(recipientAddress) {
    // Check if address already has an NFT
    if (holders.has(recipientAddress.toLowerCase())) {
        return {
            success: false,
            error: 'Address already owns an NFT'
        };
    }

    const provider = new ethers.JsonRpcProvider('https://gnosis-rpc.publicnode.com');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    try {
        const contract = new ethers.Contract(contractAddress, abi, wallet);
        const gasEstimate = await contract.safeMint.estimateGas(recipientAddress);
        const gasPrice = await provider.getFeeData();

        const tx = await contract.safeMint(recipientAddress, {
            gasLimit: BigInt(Math.ceil(Number(gasEstimate) * 1.2)),
            maxFeePerGas: gasPrice.maxFeePerGas,
            maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
        });

        const receipt = await tx.wait();
        
        // Add new holder to our list
        holders.add(recipientAddress.toLowerCase());
        
        return {
            success: true,
            transactionHash: tx.hash,
            blockNumber: receipt.blockNumber
        };

    } catch (error) {
        console.error('Error minting NFT:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

app.post('/mint', async (req, res) => {
    const { recipientAddress } = req.body;

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid Ethereum address' 
        });
    }

    try {
        const result = await mintNFT(recipientAddress);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get current holders count endpoint
app.get('/holders', (req, res) => {
    res.json({
        totalHolders: holders.size,
        holders: Array.from(holders)
    });
});

// Initialize holders list and start server
getAllHolders().then(() => {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Found ${holders.size} existing NFT holders`);
    });
});

// Refresh holders list every hour
setInterval(getAllHolders, 3600000);
