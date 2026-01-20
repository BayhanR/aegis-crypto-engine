/**
 * Aegis Crypto-Watch - UI Stream Module
 * 
 * Responsibilities:
 * - Direct DOM Update strategy (update only changed cells)
 * - High-frequency UI updates without full table refresh
 * - Signal logs management
 * - Chart.js integration for Top 5 Gainers
 * - Search/filter functionality
 * - jQuery effects and animations
 */

const UIStream = (function() {
    'use strict';
    
    // State
    let chartInstance = null;
    let allCryptoData = [];
    let filteredCryptoData = [];
    
    /**
     * Format number with commas and decimals
     * @param {number} num - Number to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted number
     */
    function formatNumber(num, decimals = 2) {
        return parseFloat(num).toLocaleString('tr-TR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    /**
     * Format large numbers (volume, etc.)
     * @param {number} num - Number to format
     * @returns {string} Formatted string (e.g., "1.5M", "500K")
     */
    function formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return formatNumber(num, 0);
    }
    
    /**
     * Get price change color class
     * @param {number} priceChangePercent - Price change percentage
     * @returns {string} CSS class name
     */
    function getPriceChangeClass(priceChangePercent) {
        if (priceChangePercent > 0) return 'price-up';
        if (priceChangePercent < 0) return 'price-down';
        return 'price-neutral';
    }
    
    /**
     * Get signal badge HTML
     * @param {Object} signal - Signal object
     * @returns {string} HTML string
     */
    function getSignalBadgeHTML(signal) {
        if (signal.type === 'WHALE_ACTIVITY') {
            return '<span class="signal-badge signal-whale">🐋 WHALE</span>';
        } else if (signal.type === 'PANIC_SELL') {
            return '<span class="signal-badge signal-panic">⚠️ PANIC</span>';
        }
        return '<span class="signal-badge signal-neutral">—</span>';
    }
    
    /**
     * Get volatility badge HTML
     * @param {Object} volatility - Volatility object
     * @returns {string} HTML string
     */
    function getVolatilityBadgeHTML(volatility) {
        const levelClass = `volatility-${volatility.level}`;
        return `<span class="volatility-badge ${levelClass}">${volatility.score}</span>`;
    }
    
    /**
     * Create or update table row for a crypto
     * Uses Direct DOM Update strategy - only updates changed cells
     * @param {Object} cryptoData - Analyzed crypto data
     */
    function updateCryptoRow(cryptoData) {
        const rowId = `crypto-${cryptoData.symbol}`;
        let $row = $(`#${rowId}`);
        
        // Create new row if it doesn't exist
        if ($row.length === 0) {
            const rowHTML = `
                <tr id="${rowId}" data-symbol="${cryptoData.symbol}" data-base="${cryptoData.baseAsset}">
                    <td class="coin-name"><strong>${cryptoData.baseAsset}</strong></td>
                    <td class="coin-price">${formatNumber(cryptoData.price)}</td>
                    <td class="coin-change ${getPriceChangeClass(cryptoData.priceChangePercent)}">
                        ${cryptoData.priceChangePercent > 0 ? '+' : ''}${formatNumber(cryptoData.priceChangePercent)}%
                    </td>
                    <td class="coin-volume">${formatLargeNumber(cryptoData.quoteVolume)}</td>
                    <td class="coin-volatility">${getVolatilityBadgeHTML(cryptoData.volatility)}</td>
                    <td class="coin-signal">${getSignalBadgeHTML(cryptoData.signal)}</td>
                </tr>
            `;
            $('#cryptoTableBody').append(rowHTML);
            $row = $(`#${rowId}`);
        } else {
            // Direct DOM Update - only update changed cells
            $row.find('.coin-price').text(formatNumber(cryptoData.price));
            
            const $changeCell = $row.find('.coin-change');
            $changeCell
                .removeClass('price-up price-down price-neutral')
                .addClass(getPriceChangeClass(cryptoData.priceChangePercent))
                .html(`${cryptoData.priceChangePercent > 0 ? '+' : ''}${formatNumber(cryptoData.priceChangePercent)}%`);
            
            $row.find('.coin-volume').text(formatLargeNumber(cryptoData.quoteVolume));
            $row.find('.coin-volatility').html(getVolatilityBadgeHTML(cryptoData.volatility));
            $row.find('.coin-signal').html(getSignalBadgeHTML(cryptoData.signal));
        }
        
        // Add highlight effect for WHALE ACTIVITY
        if (cryptoData.signal.type === 'WHALE_ACTIVITY') {
            $row.addClass('row-highlight');
            // Use jQuery UI effect if available
            if ($.ui && $.ui.effect) {
                $row.effect('highlight', { color: '#00ff88' }, 1500);
            }
            setTimeout(() => {
                $row.removeClass('row-highlight');
            }, 1500);
        }
        
        // Add highlight effect for PANIC SELL
        if (cryptoData.signal.type === 'PANIC_SELL') {
            $row.addClass('row-highlight-danger');
            if ($.ui && $.ui.effect) {
                $row.effect('highlight', { color: '#ff0066' }, 1500);
            }
            setTimeout(() => {
                $row.removeClass('row-highlight-danger');
            }, 1500);
        }
    }
    
    /**
     * Render all crypto data to table
     * @param {Array} cryptoDataArray - Array of analyzed crypto data
     */
    function renderCryptoTable(cryptoDataArray) {
        allCryptoData = cryptoDataArray;
        filteredCryptoData = cryptoDataArray;
        
        // Clear table body
        $('#cryptoTableBody').empty();
        
        // Render all rows
        cryptoDataArray.forEach(cryptoData => {
            updateCryptoRow(cryptoData);
        });
    }
    
    /**
     * Update existing rows with new data (Direct DOM Update)
     * @param {Array} cryptoDataArray - Array of analyzed crypto data
     */
    function updateCryptoTable(cryptoDataArray) {
        allCryptoData = cryptoDataArray;
        
        // Update each row directly without full refresh
        cryptoDataArray.forEach(cryptoData => {
            updateCryptoRow(cryptoData);
        });
        
        // Apply filter if active
        applyFilter();
    }
    
    /**
     * Filter table based on search input
     */
    function applyFilter() {
        const searchTerm = $('#searchInput').val().toUpperCase().trim();
        
        if (!searchTerm) {
            filteredCryptoData = allCryptoData;
        } else {
            filteredCryptoData = allCryptoData.filter(crypto => 
                crypto.baseAsset.toUpperCase().includes(searchTerm) ||
                crypto.symbol.toUpperCase().includes(searchTerm)
            );
        }
        
        // Show/hide rows based on filter
        $('#cryptoTableBody tr').each(function() {
            const $row = $(this);
            const symbol = $row.data('symbol') || '';
            const base = $row.data('base') || '';
            
            const matches = !searchTerm || 
                base.toUpperCase().includes(searchTerm) ||
                symbol.toUpperCase().includes(searchTerm);
            
            $row.toggle(matches);
        });
    }
    
    /**
     * Add signal to logs panel
     * @param {Object} cryptoData - Analyzed crypto data with signal
     */
    function addSignalLog(cryptoData) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR');
        
        const signalClass = cryptoData.signal.type === 'WHALE_ACTIVITY' ? 'signal-log-whale' : 'signal-log-panic';
        const icon = cryptoData.signal.type === 'WHALE_ACTIVITY' ? '🐋' : '⚠️';
        
        const logHTML = `
            <div class="signal-log-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <span class="signal-log-time">${timeStr}</span>
                        <br>
                        <span class="signal-log-coin">${cryptoData.baseAsset}</span>
                        <span class="${signalClass}">${icon} ${cryptoData.signal.message}</span>
                        <br>
                        <small class="text-muted">
                            Fiyat: $${formatNumber(cryptoData.price)} | 
                            Değişim: ${cryptoData.priceChangePercent > 0 ? '+' : ''}${formatNumber(cryptoData.priceChangePercent)}% |
                            Hacim: ${formatLargeNumber(cryptoData.quoteVolume)}
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        // Remove "waiting" message if exists
        $('#signalLogs .text-center').remove();
        
        // Prepend new log (most recent on top)
        $('#signalLogs').prepend(logHTML);
        
        // Limit logs to 50 items
        const $logs = $('#signalLogs .signal-log-item');
        if ($logs.length > 50) {
            $logs.slice(50).remove();
        }
    }
    
    /**
     * Initialize Chart.js for Top 5 Gainers
     */
    function initializeChart() {
        const ctx = document.getElementById('topGainersChart');
        if (!ctx) return;
        
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '24h Değişim (%)',
                    data: [],
                    backgroundColor: 'rgba(0, 243, 255, 0.6)',
                    borderColor: 'rgba(0, 243, 255, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#00f3ff',
                        bodyColor: '#fff',
                        borderColor: '#00f3ff',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#00f3ff',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 243, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#00f3ff'
                        },
                        grid: {
                            color: 'rgba(0, 243, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Update Top 5 Gainers chart
     * @param {Array} topGainers - Array of top gainer crypto data
     */
    function updateChart(topGainers) {
        if (!chartInstance) {
            initializeChart();
        }
        
        if (!chartInstance) return;
        
        const labels = topGainers.map(crypto => crypto.baseAsset);
        const data = topGainers.map(crypto => crypto.priceChangePercent);
        
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = data;
        chartInstance.update('none'); // 'none' mode for smooth updates
    }
    
    /**
     * Initialize UI components
     */
    function initialize() {
        // Initialize chart
        initializeChart();
        
        // Setup search filter
        $('#searchInput').on('input', function() {
            applyFilter();
        });
        
        // Clear logs button
        $('#clearLogsBtn').on('click', function() {
            $('#signalLogs').empty();
            $('#signalLogs').html('<div class="text-center text-muted p-3"><small>Signal bekleniyor...</small></div>');
        });
        
        console.log('UI Stream initialized');
    }
    
    // Event Listeners
    
    // Listen for analyzed data
    $(document).on('dataAnalyzed', function(event, analyzedData) {
        if ($('#cryptoTableBody tr').length === 0) {
            // First render - full table render
            renderCryptoTable(analyzedData);
        } else {
            // Subsequent updates - Direct DOM Update
            updateCryptoTable(analyzedData);
        }
    });
    
    // Listen for new signals
    $(document).on('newSignalsDetected', function(event, newSignals) {
        newSignals.forEach(signalData => {
            addSignalLog(signalData);
        });
    });
    
    // Listen for top gainers update
    $(document).on('topGainersUpdated', function(event, topGainers) {
        updateChart(topGainers);
    });
    
    // Initialize on document ready
    $(document).ready(function() {
        initialize();
    });
    
    // Public API
    return {
        renderCryptoTable,
        updateCryptoTable,
        addSignalLog,
        updateChart,
        applyFilter,
        initialize
    };
})();

// Make UIStream available globally
window.UIStream = UIStream;