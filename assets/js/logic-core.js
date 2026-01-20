/**
 * Aegis Crypto-Watch - Logic Engine (Core)
 * 
 * Responsibilities:
 * - Calculate Volatility Score
 * - Detect WHALE ACTIVITY (Strong Buy signals)
 * - Detect PANIC SELL signals
 * - Analyze market conditions
 * - Emit analyzed data events
 */

const LogicEngine = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        WHALE_THRESHOLD_PRICE_CHANGE: 3.0,    // %3 price increase
        WHALE_THRESHOLD_VOLUME: 1000000,       // 1M USDT volume
        PANIC_THRESHOLD_PRICE_CHANGE: -3.0,    // %3 price decrease
        VOLATILITY_HIGH_THRESHOLD: 5.0,        // %5 for high volatility
        VOLATILITY_MEDIUM_THRESHOLD: 2.0        // %2 for medium volatility
    };
    
    // Signal types
    const SIGNAL_TYPES = {
        WHALE_ACTIVITY: 'WHALE_ACTIVITY',
        PANIC_SELL: 'PANIC_SELL',
        NEUTRAL: 'NEUTRAL'
    };
    
    /**
     * Calculate Volatility Score based on price change percentage
     * @param {number} priceChangePercent - 24h price change percentage
     * @returns {Object} { score: number, level: string }
     */
    function calculateVolatilityScore(priceChangePercent) {
        const absChange = Math.abs(priceChangePercent);
        
        let score, level;
        
        if (absChange >= CONFIG.VOLATILITY_HIGH_THRESHOLD) {
            score = Math.min(100, Math.round((absChange / 10) * 100));
            level = 'high';
        } else if (absChange >= CONFIG.VOLATILITY_MEDIUM_THRESHOLD) {
            score = Math.round((absChange / CONFIG.VOLATILITY_HIGH_THRESHOLD) * 70);
            level = 'medium';
        } else {
            score = Math.round((absChange / CONFIG.VOLATILITY_MEDIUM_THRESHOLD) * 30);
            level = 'low';
        }
        
        return {
            score: Math.min(100, Math.max(0, score)),
            level: level
        };
    }
    
    /**
     * Detect signal type based on price change and volume
     * @param {Object} tickerData - Single ticker data object
     * @returns {Object} { type: string, message: string }
     */
    function detectSignal(tickerData) {
        const priceChangePercent = parseFloat(tickerData.priceChangePercent);
        const volume = parseFloat(tickerData.quoteVolume);
        
        // WHALE ACTIVITY Detection
        // Condition: priceChangePercent > 3% AND Volume > 1M
        if (priceChangePercent > CONFIG.WHALE_THRESHOLD_PRICE_CHANGE && 
            volume > CONFIG.WHALE_THRESHOLD_VOLUME) {
            return {
                type: SIGNAL_TYPES.WHALE_ACTIVITY,
                message: 'WHALE ACTIVITY - Strong Buy Signal',
                priority: 'high'
            };
        }
        
        // PANIC SELL Detection
        // Condition: priceChangePercent < -3%
        if (priceChangePercent < CONFIG.PANIC_THRESHOLD_PRICE_CHANGE) {
            return {
                type: SIGNAL_TYPES.PANIC_SELL,
                message: 'PANIC SELL - Market Downturn',
                priority: 'high'
            };
        }
        
        // Neutral signal
        return {
            type: SIGNAL_TYPES.NEUTRAL,
            message: 'Normal Market Activity',
            priority: 'low'
        };
    }
    
    /**
     * Analyze single ticker data
     * @param {Object} tickerData - Raw ticker data from API
     * @returns {Object} Analyzed data with signals
     */
    function analyzeTicker(tickerData) {
        const priceChangePercent = parseFloat(tickerData.priceChangePercent);
        const volatility = calculateVolatilityScore(priceChangePercent);
        const signal = detectSignal(tickerData);
        
        return {
            symbol: tickerData.symbol,
            baseAsset: tickerData.symbol.replace('USDT', ''),
            price: parseFloat(tickerData.lastPrice),
            priceChange: parseFloat(tickerData.priceChange),
            priceChangePercent: priceChangePercent,
            volume: parseFloat(tickerData.volume),
            quoteVolume: parseFloat(tickerData.quoteVolume),
            highPrice: parseFloat(tickerData.highPrice),
            lowPrice: parseFloat(tickerData.lowPrice),
            volatility: volatility,
            signal: signal,
            raw: tickerData // Keep raw data for reference
        };
    }
    
    /**
     * Analyze array of ticker data
     * @param {Array} tickerDataArray - Array of raw ticker data
     * @returns {Array} Array of analyzed ticker data
     */
    function analyzeTickerArray(tickerDataArray) {
        return tickerDataArray.map(ticker => analyzeTicker(ticker));
    }
    
    /**
     * Get top gainers from analyzed data
     * @param {Array} analyzedData - Array of analyzed ticker data
     * @param {number} limit - Number of top gainers to return
     * @returns {Array} Top gainers
     */
    function getTopGainers(analyzedData, limit = 5) {
        return analyzedData
            .filter(item => item.priceChangePercent > 0)
            .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
            .slice(0, limit);
    }
    
    /**
     * Get active signals (WHALE or PANIC)
     * @param {Array} analyzedData - Array of analyzed ticker data
     * @returns {Array} Active signals
     */
    function getActiveSignals(analyzedData) {
        return analyzedData.filter(item => 
            item.signal.type !== SIGNAL_TYPES.NEUTRAL
        );
    }
    
    /**
     * Compare previous and current data to detect new signals
     * @param {Array} previousData - Previous analyzed data
     * @param {Array} currentData - Current analyzed data
     * @returns {Array} New signals that appeared
     */
    function detectNewSignals(previousData, currentData) {
        if (!previousData || previousData.length === 0) {
            // First run - return all active signals
            return getActiveSignals(currentData);
        }
        
        const previousSignals = new Map();
        previousData.forEach(item => {
            if (item.signal.type !== SIGNAL_TYPES.NEUTRAL) {
                previousSignals.set(item.symbol, item.signal.type);
            }
        });
        
        const newSignals = [];
        currentData.forEach(item => {
            if (item.signal.type !== SIGNAL_TYPES.NEUTRAL) {
                const previousSignal = previousSignals.get(item.symbol);
                // New signal if it didn't exist before or changed type
                if (!previousSignal || previousSignal !== item.signal.type) {
                    newSignals.push(item);
                }
            }
        });
        
        return newSignals;
    }
    
    // Store previous analyzed data for comparison
    let previousAnalyzedData = [];
    
    /**
     * Process ticker data array and emit events
     * @param {Array} tickerDataArray - Raw ticker data from API
     */
    function processData(tickerDataArray) {
        // Analyze all ticker data
        const analyzedData = analyzeTickerArray(tickerDataArray);
        
        // Detect new signals
        const newSignals = detectNewSignals(previousAnalyzedData, analyzedData);
        
        // Get top gainers
        const topGainers = getTopGainers(analyzedData, 5);
        
        // Store current data for next comparison
        previousAnalyzedData = analyzedData;
        
        // Emit events
        $(document).trigger('dataAnalyzed', [analyzedData]);
        $(document).trigger('topGainersUpdated', [topGainers]);
        
        // Emit new signals if any
        if (newSignals.length > 0) {
            $(document).trigger('newSignalsDetected', [newSignals]);
        }
    }
    
    /**
     * Get configuration
     * @returns {Object}
     */
    function getConfig() {
        return { ...CONFIG };
    }
    
    /**
     * Get signal types
     * @returns {Object}
     */
    function getSignalTypes() {
        return { ...SIGNAL_TYPES };
    }
    
    // Listen for ticker data
    $(document).on('tickerDataReceived', function(event, tickerData) {
        processData(tickerData);
    });
    
    // Public API
    return {
        analyzeTicker,
        analyzeTickerArray,
        calculateVolatilityScore,
        detectSignal,
        getTopGainers,
        getActiveSignals,
        detectNewSignals,
        processData,
        getConfig,
        getSignalTypes
    };
})();

// Make LogicEngine available globally
window.LogicEngine = LogicEngine;