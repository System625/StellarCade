import { CoinFlipGame, CoinFlipGameState, CoinFlipSide } from '../../types/contracts/coinFlip';
import { formatAmount } from '../../utils/v1/formatters';
import { LoadingState, SkeletonCard } from './LoadingSkeletonSet';

export interface CoinFlipResultCardProps {
    /** The game instance to display, or null/undefined if not found */
    game?: CoinFlipGame | null;
    /** Whether the component is currently fetching or resolving data */
    isLoading?: boolean;
    /** Any error that occurred while fetching or resolving the game */
    error?: Error | null;
    /** The currently connected wallet address to determine win/loss context */
    currentWalletAddress?: string;
    /** Callback to resolve an unresolved game (if applicable/supported by parent) */
    onResolve?: (gameId: string) => void;
    /** Callback to retry fetching or resolving if an error occurs */
    onRetry?: () => void;
    /** Optional custom CSS classes */
    className?: string;
}

export function CoinFlipResultCard({
    game,
    isLoading = false,
    error = null,
    currentWalletAddress,
    onResolve,
    onRetry,
    className = ""
}: CoinFlipResultCardProps) {
    const isError = !!error;
    const isEmpty = !game && !isLoading && !isError;

    return (
        <LoadingState
            isLoading={isLoading}
            error={error}
            empty={isEmpty}
            fallback={<SkeletonCard data-testid="coinflip-skeleton" />}
            errorFallback={(err) => (
                <div className={`stellarcade-error-card ${className}`} data-testid="coinflip-error">
                    <p>Failed to load game: {err.message}</p>
                    {onRetry && (
                        <button onClick={onRetry} className="stellarcade-btn stellarcade-btn-outline mt-2">
                            Retry
                        </button>
                    )}
                </div>
            )}
            emptyFallback={
                <div className={`stellarcade-empty-card ${className}`} data-testid="coinflip-empty">
                    <p>No coin flip game found.</p>
                </div>
            }
        >
            {game && (
                <CoinFlipResultContent
                    game={game}
                    currentWalletAddress={currentWalletAddress}
                    onResolve={onResolve}
                    className={className}
                />
            )}
        </LoadingState>
    );
}

function CoinFlipResultContent({ game, currentWalletAddress, onResolve, className }: {
    game: CoinFlipGame,
    currentWalletAddress?: string,
    onResolve?: (gameId: string) => void,
    className: string
}) {
    const isPending = game.status === CoinFlipGameState.Placed || game.status === CoinFlipGameState.Pending;
    const isResolved = game.status === CoinFlipGameState.Resolved;

    // Win logic: only applicable if resolved and we know the current wallet
    const hasWinner = !!game.winner;
    const isWinner = hasWinner && currentWalletAddress && game.winner === currentWalletAddress;
    const isLoser = isResolved && hasWinner && currentWalletAddress && game.winner !== currentWalletAddress;

    const formattedWager = formatAmount(game.wager, { symbol: "XLM" });
    const formattedPayout = formatAmount(BigInt(game.wager) * 2n, { symbol: "XLM" });
    const sideName = game.side === CoinFlipSide.Heads ? "Heads" : "Tails";

    return (
        <div className={`stellarcade-card p-6 flex flex-col gap-4 ${className}`} data-testid="coinflip-content">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                <h3 className="text-lg font-bold">Coin Flip Summary</h3>
                <span className={`px-2 py-1 text-sm rounded ${isPending ? "bg-yellow-500/20 text-yellow-400" :
                        isResolved ? "bg-blue-500/20 text-blue-400" :
                            "bg-gray-500/20 text-gray-400"
                    }`}>
                    {game.status}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-400">Game ID:</span>
                <span className="text-right font-mono text-gray-200">{game.id}</span>

                <span className="text-gray-400">Your Pick:</span>
                <span className="text-right font-medium text-gray-200">{sideName}</span>

                <span className="text-gray-400">Wager:</span>
                <span className="text-right font-medium text-gray-200">{formattedWager}</span>

                {isResolved && (
                    <>
                        <span className="text-gray-400">Payout:</span>
                        <span className="text-right font-bold text-green-400">
                            {isWinner ? formattedPayout : "0 XLM"}
                        </span>
                    </>
                )}
            </div>

            {isPending && onResolve && (
                <div className="mt-2 text-center">
                    <button
                        onClick={() => onResolve(game.id)}
                        className="stellarcade-btn stellarcade-btn-primary w-full"
                    >
                        Resolve Game
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                        Waiting for blockchain confirmation to determine the outcome.
                    </p>
                </div>
            )}

            {isResolved && (
                <div className="mt-2 text-center">
                    {isWinner && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 font-bold">
                            🎉 You Won!
                        </div>
                    )}
                    {isLoser && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 font-bold">
                            Better luck next time.
                        </div>
                    )}
                    {(!isWinner && !isLoser) && (
                        <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded text-gray-400">
                            Game concluded.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
