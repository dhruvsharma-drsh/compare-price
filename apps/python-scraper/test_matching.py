from price_comparison.models import ProductResult
from price_comparison.matching import compute_similarity, group_products

def run_tests():
    p1 = ProductResult(name='iPhone 15 Pro 128GB Black', price=1000, currency='USD', url='', platform='A', country='US')
    p2 = ProductResult(name='Apple iPhone 15 Pro (128 GB) Black', price=999, currency='USD', url='', platform='B', country='US')
    p3 = ProductResult(name='Apple iPhone 15 Pro Max 128GB', price=1100, currency='USD', url='', platform='C', country='US')
    p4 = ProductResult(name='Samsung Galaxy S24 128GB', price=900, currency='USD', url='', platform='D', country='US')

    score_1_2 = compute_similarity(p1, p2)
    score_1_3 = compute_similarity(p1, p3)
    score_1_4 = compute_similarity(p1, p4)

    from price_comparison.matching import extract_attributes
    print("P1:", extract_attributes(p1.name))
    print("P3:", extract_attributes(p3.name))

    print(f"Score 1 (iPhone 15 Pro) vs 2 (iPhone 15 Pro): {score_1_2} (Expected >= 80)")
    assert score_1_2 >= 80, "P1 and P2 should match strongly"

    print(f"Score 1 (iPhone 15 Pro) vs 3 (iPhone 15 Pro Max): {score_1_3} (Expected 55-70)")
    assert 55 <= score_1_3 <= 70, "P1 and P3 should be intermediate similarity"

    print(f"Score 1 (iPhone 15 Pro) vs 4 (Samsung S24): {score_1_4} (Expected < 50)")
    assert score_1_4 < 50, "P1 and P4 should NOT match"

    groups = group_products([p1, p2, p3, p4])
    print(f"Total Groups: {len(groups)} (Expected 3)")
    for i, g in enumerate(groups):
        print(f"Group {i}: {[l.name for l in g.listings]}")
        
    print("Matching Engine verification PASSED!")

if __name__ == "__main__":
    run_tests()
