/**
 * Aegis Crypto-Watch - API Client Module
 * Binance Public API Integration
 * 
 * Responsibilities:
 * - Fetch 24hr ticker data from Binance
 * - Handle API errors and retries
 * - Emit data events for other modules
 */

const APIClient = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        API_URL: 'https://api.binance.com/api/v3/ticker/24hr',
        POLL_INTERVAL: 5000, // 5 seconds
        RETRY_DELAY: 3000,   // 3 seconds
        MAX_RETRIES: 3
    };
    
    // State
    let pollingInterval = null;
    let retryCount = 0;
    let isPolling = false;
    
    /**
     * Fetch ticker data from Binance API
     * @returns {Promise<Array>} Array of ticker data
     */
    async function fetchTickerData() {
        try {
            const response = await fetch(CONFIG.API_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Filter only USDT pairs and sort by volume
            const usdtPairs = data
                .filter(item => item.symbol.endsWith('USDT'))
                .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 100); // Top 100 by volume
            
            retryCount = 0; // Reset retry count on success
            updateConnectionStatus('connected');
            
            return usdtPairs;
            
        } catch (error) {
            console.error('API fetch error:', error);
            retryCount++;
            updateConnectionStatus('error');
            
            if (retryCount < CONFIG.MAX_RETRIES) {
                setTimeout(() => {
                    console.log(`Retrying API call (${retryCount}/${CONFIG.MAX_RETRIES})...`);
                    fetchTickerData();
                }, CONFIG.RETRY_DELAY);
            }
            
            throw error;
        }
    }
    
    /**
     * Update connection status indicator
     * @param {string} status - 'connected', 'connecting', 'error'
     */
    function updateConnectionStatus(status) {
        const $status = $('#connectionStatus');
        const $indicator = $('#statusIndicator');
        
        $status.removeClass('status-connected status-connecting status-error');
        
        switch(status) {
            case 'connected':
                $status.addClass('status-connected');
                $status.html('<span id="statusIndicator">●</span> Connected');
                break;
            case 'connecting':
                $status.addClass('status-connecting');
                $status.html('<span id="statusIndicator">●</span> Connecting...');
                break;
            case 'error':
                $status.addClass('status-error');
                $status.html('<span id="statusIndicator">●</span> Connection Error');
                break;
        }
    }
    
    /**
     * Process and emit ticker data
     */
    async function processTickerData() {
        try {
            const tickerData = await fetchTickerData();
            
            // Update last update time
            const now = new Date();
            $('#lastUpdate').text(now.toLocaleTimeString('tr-TR'));
            
            // Emit custom event with data
            $(document).trigger('tickerDataReceived', [tickerData]);
            
        } catch (error) {
            console.error('Error processing ticker data:', error);
            $(document).trigger('tickerDataError', [error]);
        }
    }
    
    /**
     * Start polling for ticker data
     */
    function startPolling() {
        if (isPolling) {
            console.warn('Polling already started');
            return;
        }
        
        isPolling = true;
        updateConnectionStatus('connecting');
        
        // Initial fetch
        processTickerData();
        
        // Set up interval
        pollingInterval = setInterval(() => {
            processTickerData();
        }, CONFIG.POLL_INTERVAL);
        
        console.log('API polling started');
    }
    
    /**
     * Stop polling
     */
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        isPolling = false;
        console.log('API polling stopped');
    }
    
    /**
     * Get current polling state
     * @returns {boolean}
     */
    function isPollingActive() {
        return isPolling;
    }
    
    /**
     * Get API configuration
     * @returns {Object}
     */
    function getConfig() {
        return { ...CONFIG };
    }
    
    // Public API
    return {
        startPolling,
        stopPolling,
        isPollingActive,
        fetchTickerData,
        getConfig
    };
})();

// Make APIClient available globally
window.APIClient = APIClient;