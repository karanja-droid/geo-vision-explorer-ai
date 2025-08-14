"""Quality Control (QC) engine for geochemistry data"""

from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from uuid import UUID
import numpy as np
import pandas as pd
from datetime import datetime

from app.models.drilling import GeochemResult, COCBatch, QCRule, QCResult
from app.schemas.drilling import QCResult as QCResultSchema

async def run_qc_analysis(db: Session, batch_id: UUID) -> List[QCResultSchema]:
    """Run comprehensive QC analysis for a batch"""
    
    batch = db.query(COCBatch).filter(COCBatch.id == batch_id).first()
    if not batch:
        raise ValueError("Batch not found")
    
    # Get all results for this batch
    results = db.query(GeochemResult).filter(
        GeochemResult.batch_id == batch.batch_id
    ).all()
    
    if not results:
        return []
    
    # Get QC rules for this project
    qc_rules = db.query(QCRule).filter(
        QCRule.project_id == batch.project_id,
        QCRule.active == True
    ).all()
    
    qc_results = []
    
    # Run different types of QC checks
    qc_results.extend(await run_standard_checks(db, batch_id, results, qc_rules))
    qc_results.extend(await run_blank_checks(db, batch_id, results))
    qc_results.extend(await run_duplicate_checks(db, batch_id, results))
    qc_results.extend(await run_detection_limit_checks(db, batch_id, results))
    
    # Save QC results to database
    for qc_result_data in qc_results:
        qc_result = QCResult(**qc_result_data)
        db.add(qc_result)
    
    db.commit()
    
    return qc_results

async def run_standard_checks(
    db: Session, 
    batch_id: UUID, 
    results: List[GeochemResult], 
    qc_rules: List[QCRule]
) -> List[Dict[str, Any]]:
    """Run standard reference material checks"""
    
    qc_results = []
    
    # Group results by sample type (assuming standards have specific naming)
    standard_results = [r for r in results if is_standard_sample(r)]
    
    for result in standard_results:
        for element, element_data in result.elements.items():
            if element_data.get('value') is None:
                continue
            
            # Find matching QC rule
            qc_rule = next((rule for rule in qc_rules if rule.element == element), None)
            if not qc_rule or qc_rule.expected_value is None:
                continue
            
            measured_value = element_data['value']
            expected_value = qc_rule.expected_value
            
            # Calculate Z-score
            z_score = calculate_z_score(measured_value, expected_value, qc_rule.tolerance_percent)
            
            # Determine flag
            flag = "pass"
            if abs(z_score) > qc_rule.control_limit:
                flag = "fail"
            elif abs(z_score) > qc_rule.warning_limit:
                flag = "warning"
            
            qc_results.append({
                'batch_id': batch_id,
                'qc_type': 'standard',
                'element': element,
                'measured_value': measured_value,
                'expected_value': expected_value,
                'z_score': z_score,
                'flag': flag,
                'notes': f"Standard check for {element}"
            })
    
    return qc_results

async def run_blank_checks(
    db: Session, 
    batch_id: UUID, 
    results: List[GeochemResult]
) -> List[Dict[str, Any]]:
    """Run blank sample checks"""
    
    qc_results = []
    
    # Find blank samples (assuming specific naming convention)
    blank_results = [r for r in results if is_blank_sample(r)]
    
    for result in blank_results:
        for element, element_data in result.elements.items():
            if element_data.get('value') is None:
                continue
            
            measured_value = element_data['value']
            detection_limit = element_data.get('detection_limit', 0)
            
            # Check if blank value is above detection limit
            flag = "pass"
            notes = f"Blank check for {element}"
            
            if detection_limit > 0 and measured_value > detection_limit * 3:
                flag = "fail"
                notes += f" - Value {measured_value} exceeds 3x detection limit ({detection_limit})"
            elif detection_limit > 0 and measured_value > detection_limit * 2:
                flag = "warning"
                notes += f" - Value {measured_value} exceeds 2x detection limit ({detection_limit})"
            
            qc_results.append({
                'batch_id': batch_id,
                'qc_type': 'blank',
                'element': element,
                'measured_value': measured_value,
                'expected_value': 0.0,
                'z_score': None,
                'flag': flag,
                'notes': notes
            })
    
    return qc_results

async def run_duplicate_checks(
    db: Session, 
    batch_id: UUID, 
    results: List[GeochemResult]
) -> List[Dict[str, Any]]:
    """Run duplicate sample checks"""
    
    qc_results = []
    
    # Find duplicate pairs (assuming naming convention like SAMPLE001 and SAMPLE001-DUP)
    duplicate_pairs = find_duplicate_pairs(results)
    
    for original, duplicate in duplicate_pairs:
        # Get common elements
        common_elements = set(original.elements.keys()) & set(duplicate.elements.keys())
        
        for element in common_elements:
            orig_data = original.elements[element]
            dup_data = duplicate.elements[element]
            
            if orig_data.get('value') is None or dup_data.get('value') is None:
                continue
            
            orig_value = orig_data['value']
            dup_value = dup_data['value']
            
            # Calculate relative percent difference (RPD)
            if orig_value + dup_value != 0:
                rpd = abs(orig_value - dup_value) / ((orig_value + dup_value) / 2) * 100
            else:
                rpd = 0
            
            # Determine flag based on RPD thresholds
            flag = "pass"
            if rpd > 20:  # >20% RPD is typically a failure
                flag = "fail"
            elif rpd > 10:  # >10% RPD is typically a warning
                flag = "warning"
            
            qc_results.append({
                'batch_id': batch_id,
                'qc_type': 'duplicate',
                'element': element,
                'measured_value': dup_value,
                'expected_value': orig_value,
                'z_score': rpd,  # Using z_score field to store RPD
                'flag': flag,
                'notes': f"Duplicate check for {element} - RPD: {rpd:.1f}%"
            })
    
    return qc_results

async def run_detection_limit_checks(
    db: Session, 
    batch_id: UUID, 
    results: List[GeochemResult]
) -> List[Dict[str, Any]]:
    """Run detection limit checks"""
    
    qc_results = []
    
    for result in results:
        for element, element_data in result.elements.items():
            if element_data.get('value') is None:
                continue
            
            measured_value = element_data['value']
            detection_limit = element_data.get('detection_limit')
            
            if detection_limit is None:
                continue
            
            # Check if value is below detection limit but reported as positive
            flag = "pass"
            notes = f"Detection limit check for {element}"
            
            if measured_value > 0 and measured_value < detection_limit:
                flag = "warning"
                notes += f" - Value {measured_value} below detection limit {detection_limit}"
            
            qc_results.append({
                'batch_id': batch_id,
                'qc_type': 'detection_limit',
                'element': element,
                'measured_value': measured_value,
                'expected_value': detection_limit,
                'z_score': None,
                'flag': flag,
                'notes': notes
            })
    
    return qc_results

def calculate_z_score(measured: float, expected: float, tolerance_percent: float) -> float:
    """Calculate Z-score for QC analysis"""
    
    if expected == 0:
        return 0
    
    # Calculate standard deviation from tolerance percentage
    std_dev = expected * (tolerance_percent / 100)
    
    if std_dev == 0:
        return 0
    
    return (measured - expected) / std_dev

def calculate_z_scores(values: List[float]) -> List[float]:
    """Calculate Z-scores for a list of values"""
    
    if len(values) < 2:
        return [0] * len(values)
    
    mean = np.mean(values)
    std = np.std(values, ddof=1)  # Sample standard deviation
    
    if std == 0:
        return [0] * len(values)
    
    return [(v - mean) / std for v in values]

def is_standard_sample(result: GeochemResult) -> bool:
    """Check if a result is from a standard reference material"""
    
    # This would typically check the sample ID or sample type
    # Common conventions: STD, STANDARD, CRM, etc.
    sample_id = getattr(result.sample, 'sample_id', '').upper()
    
    standard_indicators = ['STD', 'STANDARD', 'CRM', 'REF', 'OREAS', 'AMIS']
    
    return any(indicator in sample_id for indicator in standard_indicators)

def is_blank_sample(result: GeochemResult) -> bool:
    """Check if a result is from a blank sample"""
    
    sample_id = getattr(result.sample, 'sample_id', '').upper()
    
    blank_indicators = ['BLANK', 'BLK', 'FIELD-BLANK', 'METHOD-BLANK']
    
    return any(indicator in sample_id for indicator in blank_indicators)

def find_duplicate_pairs(results: List[GeochemResult]) -> List[tuple]:
    """Find duplicate sample pairs"""
    
    pairs = []
    
    # Group results by base sample ID (removing duplicate suffixes)
    sample_groups = {}
    
    for result in results:
        sample_id = getattr(result.sample, 'sample_id', '')
        
        # Remove common duplicate suffixes
        base_id = sample_id.replace('-DUP', '').replace('-DUPLICATE', '').replace('_DUP', '')
        
        if base_id not in sample_groups:
            sample_groups[base_id] = []
        
        sample_groups[base_id].append(result)
    
    # Find groups with exactly 2 samples (original + duplicate)
    for base_id, group in sample_groups.items():
        if len(group) == 2:
            # Determine which is original and which is duplicate
            original = group[0]
            duplicate = group[1]
            
            # If one has DUP suffix, that's the duplicate
            for result in group:
                sample_id = getattr(result.sample, 'sample_id', '')
                if 'DUP' in sample_id.upper():
                    duplicate = result
                    original = next(r for r in group if r != duplicate)
                    break
            
            pairs.append((original, duplicate))
    
    return pairs

async def generate_qc_report(db: Session, batch_id: UUID) -> Dict[str, Any]:
    """Generate comprehensive QC report for a batch"""
    
    batch = db.query(COCBatch).filter(COCBatch.id == batch_id).first()
    if not batch:
        raise ValueError("Batch not found")
    
    # Get QC results
    qc_results = db.query(QCResult).filter(QCResult.batch_id == batch_id).all()
    
    # Summarize results by type and flag
    summary = {}
    
    for qc_type in ['standard', 'blank', 'duplicate', 'detection_limit']:
        type_results = [r for r in qc_results if r.qc_type == qc_type]
        
        summary[qc_type] = {
            'total': len(type_results),
            'pass': len([r for r in type_results if r.flag == 'pass']),
            'warning': len([r for r in type_results if r.flag == 'warning']),
            'fail': len([r for r in type_results if r.flag == 'fail'])
        }
    
    # Calculate overall pass rate
    total_checks = len(qc_results)
    passed_checks = len([r for r in qc_results if r.flag == 'pass'])
    pass_rate = (passed_checks / total_checks * 100) if total_checks > 0 else 0
    
    # Generate recommendations
    recommendations = []
    
    if summary['standard']['fail'] > 0:
        recommendations.append("Review standard reference materials - some values outside control limits")
    
    if summary['blank']['fail'] > 0:
        recommendations.append("Investigate blank contamination - values above acceptable limits")
    
    if summary['duplicate']['fail'] > 0:
        recommendations.append("Review duplicate precision - high RPD values detected")
    
    if pass_rate < 90:
        recommendations.append("Overall QC pass rate below 90% - comprehensive review recommended")
    
    return {
        'batch_id': str(batch_id),
        'batch_info': {
            'batch_id': batch.batch_id,
            'lab': batch.lab,
            'sample_count': batch.sample_count,
            'submitted_date': batch.submitted_date.isoformat() if batch.submitted_date else None
        },
        'summary': summary,
        'overall': {
            'total_checks': total_checks,
            'pass_rate': round(pass_rate, 1),
            'recommendations': recommendations
        },
        'details': [
            {
                'qc_type': r.qc_type,
                'element': r.element,
                'measured_value': r.measured_value,
                'expected_value': r.expected_value,
                'z_score': r.z_score,
                'flag': r.flag,
                'notes': r.notes
            }
            for r in qc_results
        ]
    }