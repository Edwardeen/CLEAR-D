import { getCancerScoreColor, getGlaucomaScoreColor } from '../utils/scoreColors';

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
    <div className={`p-4 border rounded-lg text-center shadow-sm ${getGlaucomaScoreColor(glaucomaScore)}`}>
        <h3 className="text-lg font-semibold">Glaucoma Score</h3>
        <p className="text-3xl font-bold">{glaucomaScore} <span className="text-lg font-normal">/ 10</span></p>
        <p className="text-sm">({(glaucomaScore / 10 * 100).toFixed(0)}% Risk)</p>
    </div>
    <div className={`p-4 border rounded-lg text-center shadow-sm ${getCancerScoreColor(cancerScore)}`}>
        <h3 className="text-lg font-semibold">Cancer Score</h3>
        <p className="text-3xl font-bold">{cancerScore} <span className="text-lg font-normal">/ 10</span></p>
        <p className="text-sm">({(cancerScore / 10 * 100).toFixed(0)}% Risk)</p>
    </div>
</div> 